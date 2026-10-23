// A rule Last Light does not state (its engine takes whatever heights a sector has): a ceiling is above its floor,
// and a portal leaves an opening, or nobody can pass it and the wall pieces above and below it cross over.

import { isPortal, opening } from '../geometry/sectors'
import { formatPoint, type GeometryContext, type Problem, sectorSelection } from './check'

export function heightProblems(context: GeometryContext): Problem[] {
  const problems: Problem[] = []
  for (const sector of context.map.sectors)
    if (!(sector.ceiling > sector.floor))
      problems.push({
        message: `${sector.id}: the ceiling (${sector.ceiling} m) is not above the floor (${sector.floor} m)`,
        locator: { selection: sectorSelection(sector.id) },
      })
  // Both rooms of a portal say the same thing about it: the sentence is the same from either side, and said once.
  const said = new Set<string>()
  for (const edge of context.map.edges.filter(isPortal)) {
    const { y0, y1 } = opening(edge)
    if (y1 > y0) continue
    const [first, second] = [edge.sector.id, edge.next.id].sort()
    const middle = { x: (edge.a.x + edge.b.x) / 2, z: (edge.a.z + edge.b.z) / 2 }
    const message = `${first} and ${second}: their portal at (${formatPoint(middle)}) leaves no opening (the higher floor is ${y0} m, the lower ceiling ${y1} m)`
    if (said.has(message)) continue
    said.add(message)
    problems.push({ message, locator: context.wall(edge) })
  }
  return problems
}
