// @automata/nav/sim: routes over a scene's graph and click-to-walk, a sim entry.
// `blockedBy` moved to sectors with the map it reads; nav keeps exporting it for the games that import it from here.
export { blockedBy } from '@automata/sectors/sim'
export { loadNavGraph } from '../shared/sim/load-nav-graph'
export { NavDoor, type NavDoorPayload, WalkTo, type WalkToPayload } from '../shared/sim/nav.command'
export { NavAgent } from '../shared/sim/nav.component'
export {
  NavArrived,
  type NavArrivedPayload,
  NavUnreachable,
  type NavUnreachablePayload,
} from '../shared/sim/nav.event'
export { createNavPlugin, navPlugin } from '../shared/sim/nav.plugin'
export {
  type NavDoorState,
  NavDoors,
  NavGraphResource,
  type NavRoute,
  NavRoutes,
} from '../shared/sim/nav.resource'
export type { NavOptions } from '../shared/sim/nav.system'
export { type NavGraph, navGraphSchema } from '../shared/sim/nav-graph.schema'
export { type Blocked, clear, nearestNode, route, WALK_MARGIN } from '../shared/sim/route'
