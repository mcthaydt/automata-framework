// Every portal has its reverse over exactly the same segment, or one side of the opening is a wall.
import type { Point } from '@automata/3d/level'
import { formatPoint, type GeometryContext, type Problem } from './check'

const EPS = 1e-6
const nearPoint = (p: Point, q: Point): boolean => Math.abs(p.x - q.x) < EPS && Math.abs(p.z - q.z) < EPS

export function portalProblems(context: GeometryContext): Problem[] {
  const problems: Problem[] = []
  for (const e of context.map.edges) {
    if (!e.next) continue
    const back = e.next.loops
      .flat()
      .some((f) => f.next === e.sector && nearPoint(f.a, e.b) && nearPoint(f.b, e.a))
    if (!back)
      problems.push({
        message: `${e.sector.id} → ${e.next.id} from (${formatPoint(e.a)}) to (${formatPoint(e.b)}) has no matching portal back`,
        locator: context.wall(e),
      })
  }
  return problems
}
