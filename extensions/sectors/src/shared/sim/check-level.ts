// What a level must pass before the sim can resolve it, each fault reported at the corner, wall or id it is about as
// the 3D slice's `LevelProblem`. Nothing here throws: a tool lists the problems, and `loadSectorMap` refuses a level
// that has any. `SectorMap` is the part of a level the sim keeps (its sectors and masses).
import type { AfCorner2, AfSector2, AfSectorEntry2, LevelProblem, Plane } from '@automata/3d/level'

/** A floor or ceiling as the sim keeps it: a bare height when that is all there is, else the whole plane. */
export type StoredPlane = number | Plane

/** A sector as the sim keeps it: `af-sector/2`'s, with its planes allowed to be bare heights. */
export type StoredSector = Omit<AfSectorEntry2, 'floor' | 'ceiling'> & {
  readonly floor: StoredPlane
  readonly ceiling: StoredPlane
}

/** The part of an `af-sector/2` level the sim reads. A whole level is one. */
export type SectorMap = Omit<Pick<AfSector2, 'masses'>, never> & { readonly sectors: readonly StoredSector[] }

/** The height of a plane: the sim reads floors and ceilings flat. */
export const heightOf = (plane: StoredPlane): number => (typeof plane === 'number' ? plane : plane.z)

/** The plane's slope, if it has a real one (a slope of zero in both is flat). */
const slopeOf = (plane: StoredPlane): boolean =>
  typeof plane !== 'number' && plane.slope !== undefined && plane.slope.some((rise) => rise !== 0)

type Corner = AfCorner2
type Path = (string | number)[]
type Report = (path: Path, code: string, message: string, where: string) => void

const orientation = (a: Corner, b: Corner, c: Corner): number => {
  const value = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0])
  return value > 0 ? 1 : value < 0 ? -1 : 0
}

/** Whether `c` lies on the segment a→b, given that the three are collinear. */
const onSegment = (a: Corner, b: Corner, c: Corner): boolean =>
  Math.min(a[0], b[0]) <= c[0] &&
  c[0] <= Math.max(a[0], b[0]) &&
  Math.min(a[1], b[1]) <= c[1] &&
  c[1] <= Math.max(a[1], b[1])

/** Whether the closed segments p1→p2 and q1→q2 meet: a crossing, a touch or a collinear overlap. */
function segmentsMeet(p1: Corner, p2: Corner, q1: Corner, q2: Corner): boolean {
  const o1 = orientation(p1, p2, q1)
  const o2 = orientation(p1, p2, q2)
  const o3 = orientation(q1, q2, p1)
  const o4 = orientation(q1, q2, p2)
  if (o1 !== o2 && o3 !== o4) return true
  return (
    (o1 === 0 && onSegment(p1, p2, q1)) ||
    (o2 === 0 && onSegment(p1, p2, q2)) ||
    (o3 === 0 && onSegment(q1, q2, p1)) ||
    (o4 === 0 && onSegment(q1, q2, p2))
  )
}

const at = (loop: readonly Corner[], index: number): Corner => loop[index % loop.length] as Corner

/**
 * A loop must be simple: at least three corners, no wall of no length, and no two walls meeting except neighbours at
 * their shared corner. The first problem of a loop is reported; one bad corner usually explains the rest.
 */
function checkLoop(id: string, loop: readonly Corner[], path: Path, report: Report): void {
  if (loop.length < 3) {
    report(path, 'short-loop', `${id}: a loop needs at least three corners`, id)
    return
  }
  for (let i = 0; i < loop.length; i++) {
    const a = at(loop, i)
    const b = at(loop, i + 1)
    if (a[0] === b[0] && a[1] === b[1]) {
      report([...path, i], 'zero-wall', `${id}: the wall from corner ${i} has no length`, id)
      return
    }
  }
  for (let j = 2; j < loop.length; j++) {
    for (let i = 0; i < j - 1; i++) {
      if (i === 0 && j === loop.length - 1) continue // neighbours across the loop's start
      if (segmentsMeet(at(loop, i), at(loop, i + 1), at(loop, j), at(loop, j + 1))) {
        report(
          [...path, j],
          'wall-crossing',
          `${id}: the wall from corner ${j} crosses the wall from corner ${i}`,
          id,
        )
        return
      }
    }
  }
}

function checkPortals(
  id: string,
  loop: readonly Corner[],
  path: Path,
  ids: ReadonlySet<string>,
  report: Report,
): void {
  loop.forEach((corner, k) => {
    const next = corner[2]?.next
    if (next !== undefined && !ids.has(next))
      report([...path, k, 2, 'next'], 'unknown-portal', `${id}: no sector "${next}" for this portal`, id)
  })
}

function checkMap(map: SectorMap, report: Report): void {
  const seen = new Set<string>()
  map.sectors.forEach((sector, s) => {
    if (seen.has(sector.id))
      report(['sectors', s, 'id'], 'duplicate-id', `the sector id "${sector.id}" is used twice`, sector.id)
    seen.add(sector.id)
  })
  map.sectors.forEach((sector, s) => {
    // The sim walks on a flat floor and ceiling, so a slope is said, never read as if it were flat.
    if (slopeOf(sector.floor))
      report(
        ['sectors', s, 'floor', 'slope'],
        'sloped-floor',
        `${sector.id}: the floor slopes, which the sim cannot walk yet`,
        sector.id,
      )
    if (slopeOf(sector.ceiling))
      report(
        ['sectors', s, 'ceiling', 'slope'],
        'sloped-ceiling',
        `${sector.id}: the ceiling slopes, which the sim cannot read yet`,
        sector.id,
      )
    const loops: [readonly Corner[], Path][] = [
      [sector.corners, ['sectors', s, 'corners']],
      ...(sector.holes ?? []).map((hole, h): [readonly Corner[], Path] => [hole, ['sectors', s, 'holes', h]]),
    ]
    for (const [loop, path] of loops) {
      checkLoop(sector.id, loop, path, report)
      checkPortals(sector.id, loop, path, seen, report)
    }
  })
}

/** Every fault that stops `level` being resolved, in the order of the file. Empty when it can be. */
export function checkLevel(level: SectorMap): LevelProblem[] {
  const problems: LevelProblem[] = []
  checkMap(level, (path, code, message, where) => problems.push({ path, code, message, where }))
  return problems
}
