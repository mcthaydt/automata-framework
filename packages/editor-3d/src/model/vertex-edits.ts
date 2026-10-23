// The vertex edits (ED3D spec §5.4, ED3D.6d): `sector.addCorner`, which splits a wall in two at a point, and (next to it)
// `sector.removeCorner`, which joins the two walls at a corner into one. A wall is more than a line: it carries a door or
// a window at a distance from its start, and a portal has a reverse on the other side that must be split with it or the
// pair stops matching (the `openings` check). The rules for dividing and for joining what is set into a wall live here
// once, so that no tool re-derives them.
import { wallSelection } from '../checks/check'
import type { DoorDef, WindowDef } from '../format/sector.schema'
import type { LevelProfile } from '../profile/level-profile'
import type { EditCorner, EditSector, EditWall } from '../profile/sector-access'
import { type Edit, type EditResult, ok, refuse } from './edit'
import { noSector, placed, replaceSectors, round4, sectorOf } from './sector-edit-support'
import { cornerAt, loopOf, samePoint, wallLength, wallOver } from './wall-geometry'

/** A point is on a wall when it is this close to it, in metres: a tap a hair off the line still means the line. */
const ON_THE_WALL = 0.001

/** A feature touches the new corner when it ends this close to it, in metres, and counts as on the side it is on. */
const TOUCHES = 1e-6

export interface InsertCornerArgs {
  readonly sector: string
  /** The index of the corner that starts the wall to split, in the sector's outline. */
  readonly corner: number
  readonly x: number
  readonly z: number
}

/** The two walls a wall becomes: what is written in the corner that starts each (`undefined` is a bare corner). */
interface Halves {
  readonly first: string | EditWall | undefined
  readonly second: string | EditWall | undefined
}

type Side = 'first' | 'second'

/** The side of a place `d` metres from the wall's start that a feature spanning `start` to `end` lies on; nothing when it lies across. */
function sideOf(start: number, end: number, d: number): Side | undefined {
  if (end <= d + TOUCHES) return 'first'
  if (start >= d - TOUCHES) return 'second'
  return undefined
}

/** The wall, or nothing when it has no members: a corner has a third member only when its wall has something to say. */
const bare = (wall: EditWall): EditWall | undefined => (Object.keys(wall).length === 0 ? undefined : wall)

const shiftedDoor = (door: DoorDef, d: number): DoorDef => ({ ...door, at: round4(door.at - d) })
const shiftedWindow = (pane: WindowDef, d: number): WindowDef => ({ ...pane, at: round4(pane.at - d) })

/**
 * The wall split `d` metres from its start. Everything it says is copied to both halves (texture, trim, a handrail, a
 * mask, `thick`, `occlude`, `preset`, members a newer file carries), except what has a place along it: a door, a window
 * and a hatch lie wholly on one half and keep their place (the second half's is measured from the new corner), and one
 * the new corner would cut through is refused; a pilaster's start stays at the start and its end goes to the end.
 * A name (Last Light's cutaway) has no place and is copied.
 */
function splitWall(wall: string | EditWall | undefined, d: number): Halves | string {
  if (wall === undefined || typeof wall === 'string') return { first: wall, second: wall }
  const { door, window: pane, hatch, pilaster, ...shared } = wall
  let first: EditWall = shared
  let second: EditWall = shared

  const place = (what: string, start: number, end: number): Side | string =>
    sideOf(start, end, d) ?? `the new corner would cut through the ${what}`

  if (door !== undefined) {
    const side = place('door', door.at - door.width / 2, door.at + door.width / 2)
    if (side === 'first') first = { ...first, door }
    else if (side === 'second') second = { ...second, door: shiftedDoor(door, d) }
    else return side
  }
  if (pane !== undefined) {
    const side = place('window', pane.at - pane.width / 2, pane.at + pane.width / 2)
    if (side === 'first') first = { ...first, window: pane }
    else if (side === 'second') second = { ...second, window: shiftedWindow(pane, d) }
    else return side
  }
  if (hatch !== undefined) {
    const side = place('hatch', Math.min(...hatch), Math.max(...hatch))
    if (side === 'first') first = { ...first, hatch }
    else if (side === 'second') second = { ...second, hatch: [round4(hatch[0] - d), round4(hatch[1] - d)] }
    else return side
  }
  if (pilaster !== undefined) {
    const { start, end, ...others } = pilaster
    const half = (kept: object): EditWall['pilaster'] => {
      const members = { ...others, ...kept }
      return Object.keys(members).length === 0 ? undefined : members
    }
    const head = half(start === undefined ? {} : { start })
    const tail = half(end === undefined ? {} : { end })
    if (head !== undefined) first = { ...first, pilaster: head }
    if (tail !== undefined) second = { ...second, pilaster: tail }
  }
  return { first: bare(first), second: bare(second) }
}

/** The sector with the wall that starts at `corner` of its outline or of one of its holes made two, the new corner at `x, z`. */
function withSplit(
  sector: EditSector,
  loop: number,
  corner: number,
  [x, z]: readonly [number, number],
  { first, second }: Halves,
): EditSector {
  const split = (corners: readonly EditCorner[]): EditCorner[] => {
    const start = cornerAt(corners, corner)
    return [
      ...corners.slice(0, corner),
      placed(start[0], start[1], first),
      placed(x, z, second),
      ...corners.slice(corner + 1),
    ]
  }
  if (loop === 0) return { ...sector, corners: split(sector.corners) }
  return { ...sector, holes: (sector.holes ?? []).map((hole, i) => (i === loop - 1 ? split(hole) : hole)) }
}

/** The selection id of the wall that starts at a corner, or nothing for a sector id a selection cannot hold. */
function wallPlace(id: string, corner: number): string | undefined {
  try {
    return wallSelection(id, corner)
  } catch {
    // The one thing `wallSelection` throws is that the id has a ":" or a "/" in it.
    return undefined
  }
}

/** `result` selecting `places`, when every one of them can be named. */
function selecting<D>(result: EditResult<D>, places: readonly (string | undefined)[]): EditResult<D> {
  if (!result.ok) return result
  const named = places.filter((place): place is string => place !== undefined)
  return named.length === places.length ? ok(result.level, named) : result
}

/** The point of the segment from `a` to `z` nearest the point `p`, with its distance from `p`. */
function nearestOn(a: EditCorner, z: EditCorner, [px, pz]: readonly [number, number]) {
  const [dx, dz] = [z[0] - a[0], z[1] - a[1]]
  const length2 = dx * dx + dz * dz
  const t = length2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - a[0]) * dx + (pz - a[1]) * dz) / length2))
  const point: [number, number] = [a[0] + t * dx, a[1] + t * dz]
  return { point, off: Math.hypot(px - point[0], pz - point[1]) }
}

export function insertCorner<D>(args: InsertCornerArgs): Edit<D> {
  return {
    id: 'sector.addCorner',
    label: `Add a corner to wall ${args.corner} of ${args.sector}`,
    run(profile, level) {
      const sector = sectorOf(profile, level, args.sector)
      if (sector === undefined) return noSector(args.sector)
      if (!Number.isInteger(args.corner) || args.corner < 0 || args.corner >= sector.corners.length)
        return refuse(`sector ${args.sector} has no wall ${args.corner}`)
      if (!Number.isFinite(args.x) || !Number.isFinite(args.z)) return refuse('the point must be two numbers')
      const [from, to] = [cornerAt(sector.corners, args.corner), cornerAt(sector.corners, args.corner + 1)]
      const nearest = nearestOn(from, to, [args.x, args.z])
      if (nearest.off > ON_THE_WALL)
        return refuse(`that point is not on wall ${args.corner} of ${args.sector}`)
      const point: [number, number] = [round4(nearest.point[0]), round4(nearest.point[1])]
      if (samePoint(point, from) || samePoint(point, to)) return refuse('that point is already a corner')

      // How far along the wall, from the corner that starts it.
      const along = Math.hypot(point[0] - from[0], point[1] - from[1])
      const halves = splitWall(from[2], along)
      if (typeof halves === 'string') return refuse(halves)
      const changes = new Map<string, EditSector>([
        [sector.id, withSplit(sector, 0, args.corner, point, halves)],
      ])

      const reverse = reverseOf(profile, level, sector, args.corner)
      if (reverse !== undefined) {
        const { target, over } = reverse
        const back = cornerAt(loopOf(target, over.loop), over.corner)
        // The reverse's own places along its wall run from its own start: the same, or the length less the same.
        const length = wallLength(sector.corners, args.corner)
        const backHalves = splitWall(back[2], over.startsAtA ? along : length - along)
        if (typeof backHalves === 'string') return refuse(`${target.id}: ${backHalves}`)
        changes.set(target.id, withSplit(target, over.loop, over.corner, point, backHalves))
      }
      return selecting(replaceSectors(profile, level, changes), [
        wallPlace(sector.id, args.corner),
        wallPlace(sector.id, args.corner + 1),
      ])
    },
  }
}

/** The wall of the sector a portal leads into that runs back over the same segment, with that sector. */
function reverseOf<D>(profile: LevelProfile<D>, level: D, sector: EditSector, corner: number) {
  const into = profile.sectors.portalOf(level, cornerAt(sector.corners, corner)[2])
  // A portal into its own sector has no other side to split.
  if (into === undefined || into === sector.id) return undefined
  const target = sectorOf(profile, level, into)
  if (target === undefined) return undefined
  const over = wallOver(
    target,
    cornerAt(sector.corners, corner),
    cornerAt(sector.corners, corner + 1),
    (start) => profile.sectors.portalOf(level, start[2]) === sector.id,
  )
  return over === undefined ? undefined : { target, over }
}
