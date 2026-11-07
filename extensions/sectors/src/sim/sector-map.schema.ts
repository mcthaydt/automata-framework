// `sector-map` content (M6 spec §4.3): a scene's sectors and masses in the sector format's own shape. `sectors` adds no
// field to the format (M6-D15, M6-D17). What it adds is the checks a map must pass before it can be resolved, each
// reported at the corner, wall or id it is about, so the content compiler names the file and line (SC-c).
import { type Corner, type MassDef, massSchema, type SectorDef, sectorDefSchema } from '@automata/3d/level'
import { z } from 'zod'

export interface SectorMap {
  readonly sectors: readonly SectorDef[]
  readonly masses?: readonly MassDef[] | undefined
}

type Path = (string | number)[]
type Report = (path: Path, message: string) => void

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
    report(path, `${id}: a loop needs at least three corners`)
    return
  }
  for (let i = 0; i < loop.length; i++) {
    const a = at(loop, i)
    const b = at(loop, i + 1)
    if (a[0] === b[0] && a[1] === b[1]) {
      report([...path, i], `${id}: the wall from corner ${i} has no length`)
      return
    }
  }
  for (let j = 2; j < loop.length; j++) {
    for (let i = 0; i < j - 1; i++) {
      if (i === 0 && j === loop.length - 1) continue // neighbours across the loop's start
      if (segmentsMeet(at(loop, i), at(loop, i + 1), at(loop, j), at(loop, j + 1))) {
        report([...path, j], `${id}: the wall from corner ${j} crosses the wall from corner ${i}`)
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
      report([...path, k, 2, 'next'], `${id}: no sector "${next}" for this portal`)
  })
}

function checkMap(map: SectorMap, report: Report): void {
  const seen = new Set<string>()
  map.sectors.forEach((sector, s) => {
    if (seen.has(sector.id)) report(['sectors', s, 'id'], `the sector id "${sector.id}" is used twice`)
    seen.add(sector.id)
  })
  map.sectors.forEach((sector, s) => {
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

export const sectorMapSchema: z.ZodType<SectorMap> = z
  .looseObject({ sectors: z.array(sectorDefSchema), masses: z.array(massSchema).optional() })
  .superRefine((map, context) =>
    checkMap(map, (path, message) => context.addIssue({ code: 'custom', path, message })),
  )
