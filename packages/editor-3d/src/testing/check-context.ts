// A geometry context for the tests of the generic checks: a level's sectors, resolved, with a wall's locator taken
// straight from the expanded edge. (The real locator, which maps an edge back to the document's corner, is the
// Last Light layer's `wallLocator`.)
import { type GeometryContext, type Locator, wallSelection } from '../checks/check'
import type { SectorDef } from '../format/expand'
import type { MassDef } from '../format/sector.schema'
import { type Edge, resolveMap } from '../geometry/sectors'

export const plainWall = (edge: Edge): Locator => ({
  selection: wallSelection(edge.sector.id, edge.index),
  at: edge.a,
})

export const plainContext = (
  defs: readonly SectorDef[],
  masses: readonly MassDef[] = [],
): GeometryContext => ({
  map: resolveMap(defs, masses),
  wall: plainWall,
})
