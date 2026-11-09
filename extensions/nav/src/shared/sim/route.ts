// Routes over a scene's authored graph, from the original game's nav. Walls, steps and a game's own
// obstacles are behind `Blocked`; the graph is a parameter. Determinism: nodes are scanned in sorted id order, so ties
// go to the lower id, and distances use the sim's `hypot`.
import type { Blocked } from '@automata/places'
import type { Point } from '@automata/sectors/sim'
import { sortedKeys } from '@automata/sim'
import { hypot } from '@automata/sim/math'
import type { NavGraph } from './nav-graph.schema'

export type { Blocked }

/** The clearance a walker keeps from walls on its way between nodes, in metres (the original's). */
export const WALK_MARGIN: number = 0.2

const distance = (a: Point, b: Point): number => hypot(b.x - a.x, b.z - a.z)

export const clear = (a: Point, b: Point, blocked: Blocked, margin: number = 0): boolean =>
  !blocked.segment(a, b, margin)

/** The closest node with a clear line from `p`, or undefined when none has one. */
export function nearestNode(
  p: Point,
  graph: NavGraph,
  blocked: Blocked,
  margin: number = WALK_MARGIN,
): string | undefined {
  let best: string | undefined
  let bestDistance = Number.POSITIVE_INFINITY
  for (const id of sortedKeys(graph.nodes)) {
    const node = graph.nodes[id] as Point
    const d = distance(node, p)
    if (d < bestDistance && clear(p, node, blocked, margin)) {
      best = id
      bestDistance = d
    }
  }
  return best
}

const usable = (edge: NavGraph['edges'][number], blocked: Blocked): boolean =>
  edge[2] === undefined || blocked.open(edge[2])

/**
 * The points to walk from `from` to `to`: straight when the line is clear, else Dijkstra over the graph, then a straight
 * leg to the goal. With no route it is `[to]` (as in the original); the caller checks that leg with `clear`.
 */
export function route(
  from: Point,
  to: Point,
  graph: NavGraph,
  blocked: Blocked,
  margin: number = WALK_MARGIN,
): readonly Point[] {
  if (clear(from, to, blocked, margin)) return [to]
  // The last hop only needs a clear line: a target often hangs on a wall, inside the walking margin.
  const start = nearestNode(from, graph, blocked, margin)
  const goal = nearestNode(to, graph, blocked, margin) ?? nearestNode(to, graph, blocked, 0)
  if (start === undefined || goal === undefined) return [to]
  const best: Record<string, number> = { [start]: 0 }
  const previous: Record<string, string> = {}
  const open = new Set([start])
  while (open.size > 0) {
    // The open node nearest the start; scanned in id order, so a tie goes to the lower id.
    let current: string | undefined
    for (const id of [...open].sort())
      if (current === undefined || (best[id] as number) < (best[current] as number)) current = id
    const here = current as string
    open.delete(here)
    if (here === goal) break
    for (const edge of graph.edges) {
      if (!usable(edge, blocked)) continue
      const next = edge[0] === here ? edge[1] : edge[1] === here ? edge[0] : undefined
      if (next === undefined) continue
      const cost = (best[here] as number) + distance(graph.nodes[here] as Point, graph.nodes[next] as Point)
      if (cost < (best[next] ?? Number.POSITIVE_INFINITY)) {
        best[next] = cost
        previous[next] = here
        open.add(next)
      }
    }
  }
  if (best[goal] === undefined) return [to]
  const path: Point[] = [to]
  for (let id: string | undefined = goal; id !== undefined; id = previous[id]) {
    const node = graph.nodes[id] as Point
    path.unshift({ x: node.x, z: node.z })
  }
  // Skip leading nodes behind the walker when the next one is already in a clear line.
  while (path.length > 1 && clear(from, path[1] as Point, blocked, margin)) path.shift()
  return path
}
