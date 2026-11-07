// Reserved nodes (N-D3, from the source's nav): a node kept for one agent, so another that picks "the farthest
// reachable node" never picks it. The reservations live in `systems.state`, so a restore keeps them.
import { NavDoors, NavGraphResource } from '@automata/nav/sim'
import type { SimContext } from '@automata/sim'
import { SystemsState } from './systems.resource'

export function reserveNodes(ctx: SimContext, agent: string, ids: readonly string[]): void {
  const reserved = ctx.resource(SystemsState).reserved
  for (const id of ids) reserved[id] = agent
}

/** Whether a node can be walked to: it has a usable edge, and is not reserved for another agent (`agent` asks). */
export function reachable(ctx: SimContext, id: string, agent?: string): boolean {
  const owner = ctx.resource(SystemsState).reserved[id]
  if (owner !== undefined && owner !== agent) return false
  const doors = ctx.resource(NavDoors).open
  return ctx
    .resource(NavGraphResource)
    .edges.some(
      (edge) => (edge[0] === id || edge[1] === id) && (edge[2] === undefined || doors[edge[2]] === true),
    )
}
