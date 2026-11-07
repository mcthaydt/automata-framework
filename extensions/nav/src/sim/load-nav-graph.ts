import { type SimContext, sortedKeys } from '@mcthaydt/automata-sim'
import { NavGraphResource, NavRoutes } from './nav.resource'
import { type NavGraph, navGraphSchema } from './nav-graph.schema'

/** Makes `graph` the scene's graph and drops every walk under way. Call it from a game system; a bad graph throws. */
export function loadNavGraph(ctx: SimContext, graph: NavGraph): void {
  const checked = navGraphSchema.parse(graph)
  // A system owns the resource it changes; the readonly graph type is for its readers.
  const resource = ctx.resource(NavGraphResource) as { nodes: NavGraph['nodes']; edges: NavGraph['edges'] }
  resource.nodes = checked.nodes
  resource.edges = checked.edges
  const routes = ctx.resource(NavRoutes)
  for (const key of sortedKeys(routes)) delete routes[key]
}
