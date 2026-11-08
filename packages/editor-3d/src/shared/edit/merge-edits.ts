// The Merge edit (ED3D spec §5.4, ED3D.6e): `sector.merge` takes one sector into another that shares a stretch of wall with
// it. The shared walls go, the other sector's walls take their place in the kept sector's outline, and every wall elsewhere
// that led into the sector that went now leads into the one that stayed. The corners where the stretch began and ended are
// left behind in line with their neighbours when the cut made them, so the edit also joins the two walls at each of them when
// they say the same (the rule of `removeCorner`) and, where they are a portal, the matching two on the far side, which is
// what makes a split followed by a merge the level it began as.
import { loopArea, outlineProblem, type Planar } from '../geometry/loops'
import type { LevelProfile } from '../level-session/level-profile'
import type { EditCorner, EditSector } from '../level-session/sector-access'
import { type Edit, ok, refuse } from './edit'
import { redirectPortals } from './portal-retarget'
import {
  buildRefusal,
  holdSectors,
  noSector,
  pinnedProblem,
  placed,
  placeOf,
  sectorOf,
} from './sector-edit-support'
import { type Changes, joinWalls } from './vertex-edits'
import { cornerAt, loopsOf, near, reversedLoop, wallLength } from './wall-geometry'

export interface MergeSectorsArgs {
  /** The sector that stays: its id and every member but the outline are the result's. */
  readonly keep: string
  /** The sector that is taken into it, and goes. */
  readonly merge: string
}

/** For each wall of the kept sector that the other has a wall over, the wall of the other (written the other way round). */
function sharedWalls(keep: readonly EditCorner[], other: readonly EditCorner[]): ReadonlyMap<number, number> {
  const shared = new Map<number, number>()
  for (const [wall, from] of keep.entries()) {
    const to = cornerAt(keep, wall + 1)
    const over = other.findIndex((corner, i) => near(corner, to) && near(cornerAt(other, i + 1), from))
    if (over >= 0) shared.set(wall, over)
  }
  return shared
}

/** The walls of the kept sector where a run of shared walls begins: one whose wall before it is not shared. */
const stretchStarts = (shared: ReadonlyMap<number, number>, count: number): number[] =>
  [...shared.keys()].filter((wall) => !shared.has((wall + count - 1) % count))

/** Where a run of shared walls lies: it starts at wall `start` of the kept sector, is `length` walls long, and `across` is the wall of the other sector over its first wall. */
interface Stretch {
  readonly start: number
  readonly length: number
  readonly across: number
}

/**
 * The outline of the two sectors as one, in the direction of the kept one: the kept corners with those inside the shared
 * stretch left out and the other sector's own corners in their place, the wall at the corner where the stretch begins now the
 * other sector's. `across` is the wall of `other` over the first shared wall, and `length` the walls in the stretch.
 */
function united(
  keep: readonly EditCorner[],
  other: readonly EditCorner[],
  { start, length, across }: Stretch,
): EditCorner[] {
  const inside = new Set(Array.from({ length: length - 1 }, (_, i) => (start + 1 + i) % keep.length))
  const theirs = Array.from({ length: other.length - length - 1 }, (_, i) => cornerAt(other, across + 2 + i))
  return keep.flatMap((corner, i): EditCorner[] => {
    if (inside.has(i)) return []
    if (i !== start) return [corner]
    return [placed(corner[0], corner[1], cornerAt(other, across + 1)[2]), ...theirs]
  })
}

/** Three points of an outline on one line: the middle one could go and the line would not change. */
const inLine = (a: Planar, b: Planar, c: Planar): boolean =>
  Math.abs((b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])) < 1e-9

/** The sector with the corners of a loop in place of that loop's own (the outline is loop 0, then the holes). */
function withLoop(sector: EditSector, loop: number, corners: readonly EditCorner[]): EditSector {
  if (loop === 0) return { ...sector, corners }
  return { ...sector, holes: (sector.holes ?? []).map((hole, i) => (i === loop - 1 ? corners : hole)) }
}

interface Straightened {
  readonly sector: EditSector
  /** Where the two walls led, which is the same place for both once they agree: nothing for walls that are not portals. */
  readonly into: string | undefined
}

/**
 * The sector with the corner at `at` taken away and its two walls made one, when that corner lies between two walls that go
 * the same way, say the same (`joinWalls`) and lead to the same place; nothing when they do not.
 */
function straightened<D>(
  profile: LevelProfile<D>,
  level: D,
  sector: EditSector,
  at: Planar,
): Straightened | undefined {
  for (const [loop, corners] of loopsOf(sector).entries()) {
    const corner = corners.findIndex((each) => near(each, at))
    if (corner < 0) continue
    const previous = (corner + corners.length - 1) % corners.length
    const [before, here, after] = [
      cornerAt(corners, previous),
      cornerAt(corners, corner),
      cornerAt(corners, corner + 1),
    ]
    if (!inLine(before, here, after)) return undefined
    const firstLength = wallLength(corners, previous)
    const joined = joinWalls(before[2], here[2], {
      sector: sector.id,
      corner,
      firstLength,
      joinedLength: firstLength + wallLength(corners, corner),
    })
    if ('reason' in joined) return undefined
    const remaining = corners.flatMap((each, i): EditCorner[] => {
      if (i === corner) return []
      return [i === previous ? placed(each[0], each[1], joined.wall) : each]
    })
    return { sector: withLoop(sector, loop, remaining), into: profile.sectors.portalOf(level, before[2]) }
  }
  return undefined
}

/**
 * The merged sector and the other sectors it changed, once the corners at `points` that the two walls of a cut would leave
 * in line are taken away. A portal's far side goes with it, or the pair would not match: both are done or neither.
 */
function tidied<D>(
  profile: LevelProfile<D>,
  level: D,
  merged: EditSector,
  changes: Changes,
  points: readonly Planar[],
): { readonly merged: EditSector; readonly changes: Changes } {
  let [now, others] = [merged, changes]
  for (const point of points) {
    const own = straightened(profile, level, now, point)
    if (own === undefined) continue
    if (own.into === undefined) {
      now = own.sector
      continue
    }
    const far = others.get(own.into) ?? sectorOf(profile, level, own.into)
    const there = far === undefined ? undefined : straightened(profile, level, far, point)
    if (far === undefined || there?.into !== merged.id) continue
    now = own.sector
    others = new Map(others).set(far.id, there.sector)
  }
  return { merged: now, changes: others }
}

/** Why two sectors cannot be one when a floor or a ceiling differs: the heights of a sector are not a thing a merge may choose. */
function heightsProblem(keep: EditSector, taken: EditSector): string | undefined {
  const pair = `${keep.id} and ${taken.id} have different`
  if (keep.floor !== taken.floor)
    return `${pair} floors (${keep.floor} and ${taken.floor}): make them the same first`
  if (keep.ceiling !== taken.ceiling)
    return `${pair} ceilings (${keep.ceiling} and ${taken.ceiling}): make them the same first`
  return undefined
}

/**
 * The one stretch of wall the two sectors share (`other` is the taken sector's outline, written the way the kept one runs),
 * or the sentence for why they cannot be joined along it: none, or two, or a wall of it that leads into a third sector.
 */
function sharedStretch<D>(
  profile: LevelProfile<D>,
  level: D,
  keep: EditSector,
  taken: EditSector,
  other: readonly EditCorner[],
): Stretch | string {
  const [a, b] = [keep.id, taken.id]
  const shared = sharedWalls(keep.corners, other)
  const [start, ...laterStarts] = stretchStarts(shared, keep.corners.length)
  if (start === undefined)
    return `${a} and ${b} have no wall in common: a shared wall runs between the same two corners in both`
  if (laterStarts.length > 0)
    return `${a} and ${b} meet in more than one place, which would leave a hole between them`
  for (const [wall, over] of shared) {
    const into = [
      profile.sectors.portalOf(level, cornerAt(keep.corners, wall)[2]),
      profile.sectors.portalOf(level, cornerAt(other, over)[2]),
    ].find((place) => place !== undefined && place !== a && place !== b)
    if (into !== undefined) return `a wall between ${a} and ${b} leads into ${into}`
  }
  return { start, length: shared.size, across: shared.get(start) as number }
}

export function mergeSectors<D>(args: MergeSectorsArgs): Edit<D> {
  return {
    id: 'sector.merge',
    label: `Merge ${args.merge} into ${args.keep}`,
    run(profile, level) {
      const keep = sectorOf(profile, level, args.keep)
      if (keep === undefined) return noSector(args.keep)
      const taken = sectorOf(profile, level, args.merge)
      if (taken === undefined) return noSector(args.merge)
      if (keep.id === taken.id) return refuse('a sector cannot be merged with itself')
      for (const each of [keep, taken]) {
        const tied = pinnedProblem(profile, level, each.id, 'merged')
        if (tied !== undefined) return refuse(tied, placeOf(each.id))
      }
      const heights = heightsProblem(keep, taken)
      if (heights !== undefined) return refuse(heights)

      // Each outline may be written either way round; the union is written the way the kept one is.
      const same = Math.sign(loopArea(keep.corners)) === Math.sign(loopArea(taken.corners))
      const other = same ? taken.corners : reversedLoop(taken.corners)
      const stretch = sharedStretch(profile, level, keep, taken, other)
      if (typeof stretch === 'string') return refuse(stretch)
      const corners = united(keep.corners, other, stretch)
      const problem = outlineProblem(corners)
      if (problem !== undefined)
        return refuse(`${keep.id} and ${taken.id} do not make one sector: ${problem}`)

      const redirected = redirectPortals(profile, level, new Map(), { from: taken.id, to: keep.id })
      const holes = [...(keep.holes ?? []), ...(taken.holes ?? [])]
      const { holes: _holes, ...rest } = keep
      const union: EditSector = { ...rest, corners, ...(holes.length === 0 ? {} : { holes }) }
      // The corners the stretch began and ended at, which a cut leaves in line with their neighbours.
      const ends = [
        cornerAt(keep.corners, stretch.start),
        cornerAt(keep.corners, stretch.start + stretch.length),
      ]
      const joined = tidied(profile, level, union, redirected, ends)

      const sectors = profile.sectors
        .list(level)
        .flatMap((each) =>
          each.id === taken.id
            ? []
            : [each.id === keep.id ? joined.merged : (joined.changes.get(each.id) ?? each)],
        )
      const held = holdSectors(profile, level, sectors)
      if (!held.ok) return held
      return (
        buildRefusal(profile, held.level) ??
        ok(
          held.level,
          [keep.id].flatMap((id) => placeOf(id) ?? []),
        )
      )
    },
  }
}
