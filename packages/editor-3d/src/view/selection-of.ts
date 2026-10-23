// The one place the views get a selection id from (ED3D.4 step 2). The plan, a pick, a snap and a mesh all name what they
// show by the ids `checks/check.ts` writes, and all through this, so that they agree: `sector:<id>` for a sector the
// document lists, and for a wall the locator's answer (`wall:<sector>/<corner>` for a wall of the file's own outline,
// the sector for any other). What only the geometry has, such as Last Light's opening connectors, has no selection:
// it is drawn, and nothing selects it.
import { place, sectorSelection } from '../checks/check'
import { wallLocator } from '../checks/wall-locator'
import type { Edge } from '../geometry/sectors'
import type { LevelProfile } from '../profile/level-profile'

export interface SelectionOf {
  /** The selection of a sector the document lists; nothing for any other id, or one that cannot be part of an id. */
  sector(id: string): string | undefined
  /** The selection of a wall of a listed sector; nothing for a wall of a derived one. */
  edge(edge: Edge): string | undefined
}

export function selectionOf<D>(profile: LevelProfile<D>, level: D): SelectionOf {
  const listed = profile.sectors.list(level)
  const ids = new Set(listed.map((sector) => sector.id))
  const locate = wallLocator(listed)
  return {
    sector: (id) => (ids.has(id) ? place(() => sectorSelection(id))?.selection : undefined),
    edge: (edge) => (ids.has(edge.sector.id) ? locate(edge)?.selection : undefined),
  }
}
