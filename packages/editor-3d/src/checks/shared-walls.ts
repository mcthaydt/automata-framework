// Extracted from The Last Light scripts/pipeline/blockout-lib.ts `sharedWalls` (92e6704): two solid walls of different
// rooms on one line, facing each other, each hide the other's face from every lamp. The arithmetic and the sentence
// are Last Light's; what is added is where the problem is.
import type { Problem } from './check'
import { formatPoint, type GeometryContext } from './check'

/** Walls closer than this to one line, and sharing no more than 1 cm of it, are not one line. */
const SAME_LINE = 1e-3
const MIN_SHARED = 0.01

export function sharedWallProblems(context: GeometryContext): Problem[] {
  const problems: Problem[] = []
  const solid = context.map.edges.filter((edge) => !edge.next)
  for (let i = 0; i < solid.length; i++) {
    for (let j = i + 1; j < solid.length; j++) {
      const e = solid[i]
      const f = solid[j]
      if (!e || !f) continue
      if (e.sector === f.sector || e.dir.x * f.dir.x + e.dir.z * f.dir.z > -1 + 1e-6) continue
      const off = (p: { x: number; z: number }) => (p.x - e.a.x) * e.normal.x + (p.z - e.a.z) * e.normal.z
      if (Math.abs(off(f.a)) > SAME_LINE || Math.abs(off(f.b)) > SAME_LINE) continue
      const along = (p: { x: number; z: number }) => (p.x - e.a.x) * e.dir.x + (p.z - e.a.z) * e.dir.z
      const overlap =
        Math.min(e.length, Math.max(along(f.a), along(f.b))) - Math.max(0, Math.min(along(f.a), along(f.b)))
      if (overlap > MIN_SHARED)
        problems.push({
          message: `${e.sector.id} and ${f.sector.id} share a solid wall line from (${formatPoint(e.a)}) for ${overlap.toFixed(2)} m: stand them apart with an opening's connector`,
          locator: context.wall(e),
          related: [context.wall(f)],
        })
    }
  }
  return problems
}
