// The Split edit (ED3D spec §5.4, ED3D.6e): `sector.split` cuts a sector in two along a straight line between two points
// of its outline. Each end may be a corner or a place on a wall (which gets a corner, by the rules of the vertex edits, so a
// door, a window and a portal's reverse are divided with it). The line becomes a wall of each half, a portal into the other,
// and every portal that went to the far side of a wall now held by the new sector is turned to point back at it.
import { insideLoop, loopArea, outlineProblem, segmentsTouch } from '../geometry/loops'
import type { LevelProfile } from '../level-session/level-profile'
import type { EditCorner, EditSector } from '../level-session/sector-access'
import { type Edit, ok, refuse } from './edit'
import { type PortalSpan, retargetPortals } from './portal-retarget'
import {
  buildRefusal,
  holdSectors,
  newIdProblem,
  noSector,
  pinnedProblem,
  placeOf,
  sectorOf,
} from './sector-edit-support'
import { type Changes, cornerInserted, nearestOn, ON_THE_WALL } from './vertex-edits'
import { cornerAt, loopsOf } from './wall-geometry'

export interface SplitSectorArgs {
  readonly sector: string
  /** The id of the new sector: the half of the cut that is smaller (the first point's half when they are the same size). */
  readonly id: string
  /** Where the cut starts and ends: points on the outline of the sector, within a millimetre. */
  readonly from: { readonly x: number; readonly z: number }
  readonly to: { readonly x: number; readonly z: number }
}

type Point = readonly [number, number]

/** Two halves this near in area, in square metres, are the same size. */
const TIE = 1e-9

/** Where an end of the cut lies on the outline: at a corner, or inside a wall (named by the corner that starts it). */
type Spot =
  | { readonly corner: number; readonly point: Point }
  | { readonly wall: number; readonly point: Point }

/** The place on the outline within reach of `at`: a corner before a wall, so that a tap near a corner means the corner. */
function spotOn(corners: readonly EditCorner[], at: Point): Spot | undefined {
  for (const [corner, here] of corners.entries())
    if (Math.hypot(here[0] - at[0], here[1] - at[1]) <= ON_THE_WALL)
      return { corner, point: [here[0], here[1]] }
  for (const [wall, from] of corners.entries()) {
    const { point, off } = nearestOn(from, cornerAt(corners, wall + 1), at)
    if (off <= ON_THE_WALL) return { wall, point }
  }
  return undefined
}

/** The walls of the outline that an end of the cut is on or at the end of. */
const wallsAt = (spot: Spot, count: number): readonly number[] =>
  'wall' in spot ? [spot.wall] : [(spot.corner + count - 1) % count, spot.corner]

/** Why a sector cannot be cut by any line: it leads into itself, or something is tied to its walls or its name. */
function tiedProblem<D>(profile: LevelProfile<D>, level: D, sector: EditSector): string | undefined {
  const itself = loopsOf(sector).some((loop) =>
    loop.some((corner) => profile.sectors.portalOf(level, corner[2]) === sector.id),
  )
  if (itself) return `${sector.id} has a portal into itself`
  return pinnedProblem(profile, level, sector.id, 'cut')
}

/**
 * Why the sector cannot be cut by any line, before the line is looked at: what `splitSector` refuses with first. The Split
 * tool asks it at the first tap, so a sector that cannot be cut is refused there and not at the second. Nothing for a
 * sector the level does not have: the edit has its own sentence for that.
 */
export function cutProblem<D>(profile: LevelProfile<D>, level: D, id: string): string | undefined {
  const sector = sectorOf(profile, level, id)
  return sector === undefined ? undefined : tiedProblem(profile, level, sector)
}

/** The two ends of the cut on the outline of the sector, or the sentence for why they are not a cut of it. */
function endsOf(sector: EditSector, from: Point, to: Point): readonly [Spot, Spot] | string {
  if (![...from, ...to].every(Number.isFinite)) return 'the cut must be two points'
  const [start, end] = [spotOn(sector.corners, from), spotOn(sector.corners, to)]
  if (start === undefined || end === undefined) return `that point is not on the outline of ${sector.id}`
  if (Math.hypot(start.point[0] - end.point[0], start.point[1] - end.point[1]) <= ON_THE_WALL)
    return 'the cut starts and ends at the same point'
  const count = sector.corners.length
  if (wallsAt(start, count).some((wall) => wallsAt(end, count).includes(wall)))
    return `the cut runs along a wall of ${sector.id}`
  const touchesHole = (sector.holes ?? []).some((hole) =>
    hole.some((corner, i) => segmentsTouch(start.point, end.point, corner, cornerAt(hole, i + 1))),
  )
  if (touchesHole) return `that cut crosses a hole of ${sector.id}`
  return [start, end]
}

/** Where an end of the cut is in the outline once a corner has been made for each end that lay inside a wall. */
function indexOf(spot: Spot, madeAt: readonly number[]): number {
  if ('corner' in spot) return spot.corner + madeAt.filter((wall) => wall < spot.corner).length
  return spot.wall + 1 + madeAt.filter((wall) => wall < spot.wall).length
}

/** The corners of an outline from index `first` round to index `last`, as indices. */
const stretch = (count: number, first: number, last: number): readonly number[] =>
  Array.from({ length: ((last - first + count) % count) + 1 }, (_, i) => (first + i) % count)

/**
 * One half of the cut as a sector's corners: the corners of the stretch, the last of them starting the new wall back to the
 * first (a portal into `other`), the loop written from the corner that came first in the outline.
 */
function halfOf(corners: readonly EditCorner[], indices: readonly number[], other: string): EditCorner[] {
  const last = indices.length - 1
  const made = indices.map((at, i): EditCorner => {
    const corner = cornerAt(corners, at)
    return i === last ? [corner[0], corner[1], { next: other }] : corner
  })
  const lowest = indices.indexOf(Math.min(...indices))
  return [...made.slice(lowest), ...made.slice(0, lowest)]
}

/** The portals among the walls that start at these corners of a loop: where each begins and ends, and where it leads. */
function portalsOf<D>(
  profile: LevelProfile<D>,
  level: D,
  corners: readonly EditCorner[],
  walls: readonly number[],
): PortalSpan[] {
  return walls.flatMap((at): PortalSpan[] => {
    const [start, end] = [cornerAt(corners, at), cornerAt(corners, at + 1)]
    const into = profile.sectors.portalOf(level, start[2])
    return into === undefined ? [] : [{ start: [start[0], start[1]], end: [end[0], end[1]], into }]
  })
}

const everyWall = (corners: readonly EditCorner[]): readonly number[] => corners.map((_, i) => i)

/** The sector with a corner made for each end of the cut that lies inside a wall, and where the two ends are in its outline. */
interface Prepared {
  readonly changes: Changes
  readonly work: EditSector
  readonly first: number
  readonly last: number
}

function prepared<D>(
  profile: LevelProfile<D>,
  level: D,
  sector: EditSector,
  ends: readonly [Spot, Spot],
): Prepared | string {
  // The later wall first, so that the index of the earlier one holds.
  const inWalls = ends.flatMap((spot) => ('wall' in spot ? [spot] : [])).sort((a, b) => b.wall - a.wall)
  let changes: Changes = new Map()
  for (const spot of inWalls) {
    const made = cornerInserted(profile, level, changes, {
      sector: sector.id,
      corner: spot.wall,
      x: spot.point[0],
      z: spot.point[1],
    })
    if (typeof made === 'string') return made
    changes = made
  }
  const madeAt = inWalls.map((spot) => spot.wall)
  const [first, last] = ends.map((spot) => indexOf(spot, madeAt)) as [number, number]
  return { changes, work: changes.get(sector.id) ?? sector, first, last }
}

/** The two sectors a cut makes, and the portals among the walls the new one holds. */
interface Division {
  readonly kept: EditSector
  readonly fresh: EditSector
  readonly spans: readonly PortalSpan[]
}

/**
 * The sector cut between corners `first` and `last` of its outline, or the sentence for why the line cannot be cut. The
 * larger half keeps the sector's id, and the half from the first point to the second does when they are the same size; a hole
 * goes with the half it lies in.
 */
function divided<D>(
  profile: LevelProfile<D>,
  level: D,
  work: EditSector,
  id: string,
  [first, last]: readonly [number, number],
): Division | string {
  const count = work.corners.length
  const [forward, backward] = [stretch(count, first, last), stretch(count, last, first)]
  const [outlineForward, outlineBackward] = [forward, backward].map((indices) =>
    indices.map((at) => cornerAt(work.corners, at)),
  ) as [EditCorner[], EditCorner[]]
  // Cut inside the sector, both halves are outlines that run the way the sector's does; outside it, one runs the other way.
  const direction = Math.sign(loopArea(work.corners))
  const [areaForward, areaBackward] = [
    loopArea(outlineForward) * direction,
    loopArea(outlineBackward) * direction,
  ]
  if (
    outlineProblem(outlineForward) !== undefined ||
    outlineProblem(outlineBackward) !== undefined ||
    areaForward <= 0 ||
    areaBackward <= 0
  )
    return `that cut does not stay inside ${work.id}`

  const keepsForward = areaForward >= areaBackward - TIE
  const [keptStretch, freshStretch] = keepsForward ? [forward, backward] : [backward, forward]
  const freshOutline = keepsForward ? outlineBackward : outlineForward
  const holes = work.holes ?? []
  const inFresh = (hole: readonly EditCorner[]): boolean =>
    insideLoop(cornerAt(hole, 0)[0], cornerAt(hole, 0)[1], freshOutline)
  const [keptHoles, freshHoles] = [holes.filter((hole) => !inFresh(hole)), holes.filter(inFresh)]

  const { holes: _holes, ...rest } = work
  const withHoles = (loops: readonly (readonly EditCorner[])[]) =>
    loops.length === 0 ? {} : { holes: loops }
  return {
    kept: {
      ...rest,
      corners: halfOf(work.corners, keptStretch, id),
      ...withHoles(keptHoles),
    },
    fresh: {
      ...rest,
      id,
      corners: halfOf(work.corners, freshStretch, work.id),
      ...withHoles(freshHoles),
    },
    spans: [
      ...portalsOf(profile, level, work.corners, freshStretch.slice(0, -1)),
      ...freshHoles.flatMap((hole) => portalsOf(profile, level, hole, everyWall(hole))),
    ],
  }
}

export function splitSector<D>(args: SplitSectorArgs): Edit<D> {
  return {
    id: 'sector.split',
    label: `Split ${args.sector} into ${args.sector} and ${args.id}`,
    run(profile, level) {
      const sector = sectorOf(profile, level, args.sector)
      if (sector === undefined) return noSector(args.sector)
      const idProblem = newIdProblem(profile, level, args.id)
      if (idProblem !== undefined) return refuse(idProblem)
      const tied = tiedProblem(profile, level, sector)
      if (tied !== undefined) return refuse(tied, placeOf(sector.id))
      const ends = endsOf(sector, [args.from.x, args.from.z], [args.to.x, args.to.z])
      if (typeof ends === 'string') return refuse(ends)
      const made = prepared(profile, level, sector, ends)
      if (typeof made === 'string') return refuse(made)
      const division = divided(profile, level, made.work, args.id, [made.first, made.last])
      if (typeof division === 'string') return refuse(division)
      const { kept, fresh, spans } = division

      // The far side of every portal in the walls that went to the new sector now leads back into it.
      const moved = retargetPortals(profile, level, made.changes, {
        from: sector.id,
        to: args.id,
        spans,
      })
      const sectors = profile.sectors
        .list(level)
        .flatMap((each) => (each.id === sector.id ? [kept, fresh] : [moved.get(each.id) ?? each]))
      const held = holdSectors(profile, level, sectors)
      if (!held.ok) return held
      return (
        buildRefusal(profile, held.level, args.id) ??
        ok(
          held.level,
          [sector.id, args.id].flatMap((id) => placeOf(id) ?? []),
        )
      )
    },
  }
}
