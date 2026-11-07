// The one place the views get a selection id from (ED3D.4 step 2). The plan, a pick, a snap and a mesh all name what they
// show by the ids `checks/check.ts` writes, and all through this, so that they agree: `sector:<id>` for a sector the
// document lists, and for a wall the locator's answer (`wall:<sector>/<corner>` for a wall of the file's own outline,
// the sector for any other). What only the geometry has, such as Last Light's opening connectors, has no selection:
// it is drawn, and nothing selects it.

import type { Point } from '@automata/3d/level'
import { place, sectorSelection } from '../checks/check'
import { wallLocator } from '../checks/wall-locator'
import type { Edge } from '../geometry/sectors'
import type { LevelProfile } from '../profile/level-profile'

export interface SelectionOf {
  /** The selection of a sector the document lists; nothing for any other id, or one that cannot be part of an id. */
  sector(id: string): string | undefined
  /** The selection of a wall of a listed sector; nothing for a wall of a derived one. */
  edge(edge: Edge): string | undefined
  /**
   * The corners of a listed sector's outline as the document has them, in document order: the index a wall's selection
   * id and `moveCorner` use. The resolved geometry cannot say, because it turns a loop round and adds corners round a
   * pilaster. Empty for a sector the document does not list.
   */
  corners(id: string): readonly Point[]
}

export function selectionOf<D>(profile: LevelProfile<D>, level: D): SelectionOf {
  const listed = profile.sectors.list(level)
  const ids = new Set(listed.map((sector) => sector.id))
  const locate = wallLocator(listed)
  // The first sector of an id, as the locator reads it.
  const outlines = new Map<string, readonly Point[]>()
  for (const sector of listed)
    if (!outlines.has(sector.id))
      outlines.set(
        sector.id,
        sector.corners.map(([x, z]) => ({ x, z })),
      )
  return {
    sector: (id) => (ids.has(id) ? place(() => sectorSelection(id))?.selection : undefined),
    edge: (edge) => (ids.has(edge.sector.id) ? locate(edge)?.selection : undefined),
    corners: (id) => outlines.get(id) ?? [],
  }
}
