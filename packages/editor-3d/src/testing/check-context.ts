// A geometry context for the tests of the generic checks: a level's sectors, resolved, with a wall's locator taken
// straight from the expanded edge. (The real locator, which maps an edge back to the document's corner, is the
// `wallLocator`.)

import type { MassDef, SectorDef } from '@automata/3d/level'
import { type GeometryContext, type Locator, wallSelection } from '../shared/checks/check'
import { type Edge, resolveMap } from '../shared/geometry/sectors'

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
