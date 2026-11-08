// The corner and sector moves (ED3D spec §5.3 flow 3, §5.4, ED3D.3 step 6): `sector.moveCorner` and `sector.move`. A
// corner of a portal wall drags the matching corner of its reverse (spec: "moving a corner of a portal wall moves its
// reverse"), so the portal stays a portal; moving a whole sector does not drag its neighbours, and leaves their portals
// where they were for the `openings` check to name (ED3-e). Neither writes a number past four decimals.
import type { Planar } from '../geometry/loops'
import { outlineProblem } from '../geometry/loops'
import type { LevelProfile } from '../level-session/level-profile'
import type { EditCorner, EditSector } from '../level-session/sector-access'
import { type Edit, ok, refuse } from './edit'
import { noSector, placed, replaceSector, replaceSectors, round4, sectorOf } from './sector-edit-support'
import { cornerAt, loopOf, loopsOf, samePoint, wallOver } from './wall-geometry'

/** A corner of one loop of a sector: loop 0 is the outline and each loop after it a hole. */
interface Spot {
  readonly sector: string
  readonly loop: number
  readonly corner: number
}

const keyOf = (spot: Spot): string => `${spot.sector}/${spot.loop}/${spot.corner}`

/** The corner of `target` at `a` that belongs to a wall leading back into `from` over the segment between `a` and `z`. */
function reverseCorner<D>(
  profile: LevelProfile<D>,
  level: D,
  target: EditSector,
  from: string,
  a: Planar,
  z: Planar,
): Spot | undefined {
  const wall = wallOver(target, a, z, (start) => profile.sectors.portalOf(level, start[2]) === from)
  if (wall === undefined) return undefined
  const corner = wall.startsAtA ? wall.corner : (wall.corner + 1) % loopOf(target, wall.loop).length
  return { sector: target.id, loop: wall.loop, corner }
}

/**
 * The corner and every corner that meets it through portals, in the order they were found, each once: the corner of
 * the reverse of each of its two walls, then the same from each of those. A corner shared by sectors that join only
 * through a third one comes along, so no portal of the junction is left behind.
 */
function joinedCorners<D>(
  profile: LevelProfile<D>,
  level: D,
  sectors: ReadonlyMap<string, EditSector>,
  start: Spot,
): Spot[] {
  const found = [start]
  const seen = new Set([keyOf(start)])
  for (let i = 0; i < found.length; i++) {
    const spot = found[i] as Spot
    const corners = loopOf(sectors.get(spot.sector) as EditSector, spot.loop)
    const [leaving, arriving] = [spot.corner, (spot.corner + corners.length - 1) % corners.length]
    // Each wall at the corner, with the end of it that is not this corner.
    for (const [wallStart, other] of [
      [leaving, leaving + 1],
      [arriving, arriving],
    ] as const) {
      const into = profile.sectors.portalOf(level, cornerAt(corners, wallStart)[2])
      const target = into === undefined ? undefined : sectors.get(into)
      if (target === undefined) continue
      const reverse = reverseCorner(
        profile,
        level,
        target,
        spot.sector,
        cornerAt(corners, spot.corner),
        cornerAt(corners, other),
      )
      if (reverse === undefined || seen.has(keyOf(reverse))) continue
      seen.add(keyOf(reverse))
      found.push(reverse)
    }
  }
  return found
}

/** The sector with the corner of one of its loops put at a point, keeping the wall the corner starts. */
function withCornerAt(sector: EditSector, spot: Spot, x: number, z: number): EditSector {
  const move = (corners: readonly EditCorner[]): EditCorner[] =>
    corners.map((corner, i) => (i === spot.corner ? placed(x, z, corner[2]) : corner))
  if (spot.loop === 0) return { ...sector, corners: move(sector.corners) }
  return {
    ...sector,
    holes: (sector.holes ?? []).map((hole, i) => (i === spot.loop - 1 ? move(hole) : hole)),
  }
}

export interface MoveCornerArgs {
  readonly sector: string
  /** The index of the corner in the sector's outline. */
  readonly corner: number
  readonly x: number
  readonly z: number
}

export function moveCorner<D>(args: MoveCornerArgs): Edit<D> {
  return {
    id: 'sector.moveCorner',
    label: `Move corner ${args.corner} of ${args.sector}`,
    coalesce: `corner:${args.sector}/${args.corner}`,
    run(profile, level) {
      const sector = sectorOf(profile, level, args.sector)
      if (sector === undefined) return noSector(args.sector)
      if (!Number.isInteger(args.corner) || args.corner < 0 || args.corner >= sector.corners.length)
        return refuse(`sector ${args.sector} has no corner ${args.corner}`)
      if (!Number.isFinite(args.x) || !Number.isFinite(args.z)) return refuse('the point must be two numbers')
      const [x, z] = [round4(args.x), round4(args.z)]
      if (samePoint(cornerAt(sector.corners, args.corner), [x, z])) return ok(level)
      const sectors = new Map(profile.sectors.list(level).map((each) => [each.id, each]))
      const spots = joinedCorners(profile, level, sectors, {
        sector: args.sector,
        loop: 0,
        corner: args.corner,
      })
      const changes = new Map<string, EditSector>()
      for (const spot of spots) {
        const before = changes.get(spot.sector) ?? (sectors.get(spot.sector) as EditSector)
        changes.set(spot.sector, withCornerAt(before, spot, x, z))
      }
      // A drag may not take any outline it touches out of being a polygon: the sector's own first, then the ones that follow.
      for (const spot of spots) {
        const problem = outlineProblem(loopOf(changes.get(spot.sector) as EditSector, spot.loop))
        if (problem !== undefined)
          return refuse(spot.sector === args.sector ? problem : `${spot.sector}: ${problem}`)
      }
      return replaceSectors(profile, level, changes)
    },
  }
}

export function moveSector<D>(args: {
  readonly id: string
  readonly dx: number
  readonly dz: number
}): Edit<D> {
  return {
    id: 'sector.move',
    label: `Move sector ${args.id}`,
    coalesce: `move:${args.id}`,
    run(profile, level) {
      const sector = sectorOf(profile, level, args.id)
      if (sector === undefined) return noSector(args.id)
      if (!Number.isFinite(args.dx) || !Number.isFinite(args.dz))
        return refuse('the offset must be two numbers')
      const shifted = (corners: readonly EditCorner[]): EditCorner[] =>
        corners.map(([x, z, wall]) => placed(round4(x + args.dx), round4(z + args.dz), wall))
      const loops = loopsOf(sector)
      const moved = loops.map(shifted)
      const unchanged = loops.every((loop, l) =>
        loop.every((corner, i) => samePoint(corner, cornerAt(moved[l] as EditCorner[], i))),
      )
      if (unchanged) return ok(level)
      const [corners, ...holes] = moved as [EditCorner[], ...EditCorner[][]]
      const next: EditSector = { ...sector, corners, ...(sector.holes === undefined ? {} : { holes }) }
      return replaceSector(profile, level, args.id, next)
    },
  }
}
