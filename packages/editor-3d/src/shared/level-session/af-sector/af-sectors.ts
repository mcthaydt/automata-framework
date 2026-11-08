// The rooms of an `af-sector/2` level as the editor's edits see them (Levels 3D spec §5): one view per room, with the
// floor and ceiling as heights and a wall's texture as a name (`room-views.ts`), and the edits' result written back into
// the file's own members. The one thing a level cannot hold is a wall written as a name (Last Light's spelling of a
// cutaway group), which no edit makes for it and which is refused if one arrives.
import type { AfSector2File, AfSectorEntry2File } from '@automata/3d/level'
import { insideOutline } from '../../geometry/loops'
import {
  type EditCorner,
  type EditSector,
  type EditWall,
  inheritedMaterials,
  portalReferences,
  type SectorAccess,
  SectorAccessError,
} from '../sector-access'
import { roomView, writeRoom } from './room-views'

/** Where a wall leads; a name (Last Light's spelling of a cutaway group) leads nowhere. */
const nextOf = (wall: string | EditWall | undefined): string | undefined =>
  typeof wall === 'object' ? wall.next : undefined

const viewsOf = (level: AfSector2File): readonly EditSector[] => level.sectors.map(roomView)

export const afSectorAccess: SectorAccess<AfSector2File> = {
  list: viewsOf,
  withSectors(level, sectors) {
    const own = level.sectors
    if (
      sectors.length === own.length &&
      sectors.every((sector, i) => sector === roomView(own[i] as AfSectorEntry2File))
    )
      return level
    let entries: AfSectorEntry2File[]
    try {
      entries = sectors.map(writeRoom)
    } catch (error) {
      if (error instanceof RangeError) throw new SectorAccessError(error.message)
      throw error
    }
    return { ...level, sectors: entries }
  },
  takenIds: (level) => level.sectors.map((sector) => sector.id),
  create: (_level, draft) => ({
    id: draft.id,
    floor: draft.floor,
    ceiling: draft.ceiling,
    light: draft.light,
    ...inheritedMaterials(draft.like),
    corners: draft.corners.map(([x, z]): EditCorner => [x, z]),
  }),
  portalOf: (_level, wall) => nextOf(wall),
  // A wall of an `af-sector` level is named by no one: its entities stand in a sector by position, not by wall number.
  pinned: () => [],
  references(level, id) {
    const found = portalReferences(viewsOf(level), id, 'sector', nextOf)
    const sector = level.sectors.find((each) => each.id === id)
    if (sector === undefined) return found
    for (const entity of level.entities ?? [])
      if (insideOutline(entity.x, entity.z, sector.corners, sector.holes))
        found.push(`entity ${entity.id} stands in it`)
    return found
  },
}
