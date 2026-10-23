// The sectors of an `af-sector/1` level as the editor's edits see them (ED3D spec §4.1). The level's sectors already are
// `EditSector`s, so `list` hands them over as they are, and `withSectors` is a spread of the level with other sectors in
// that place. The one thing an `af-sector` level cannot hold is a wall written as a name (Last Light's spelling of a
// cutaway group), which no edit makes for it and which is refused if one arrives.
import type { AfCorner, AfSector, AfSectorEntry } from '../../format/af-sector.schema'
import { insideOutline } from '../../geometry/loops'
import {
  type EditCorner,
  type EditSector,
  inheritedMaterials,
  portalReferences,
  type SectorAccess,
  SectorAccessError,
} from '../sector-access'

function afCorner(corner: EditCorner): AfCorner {
  const [x, z, wall] = corner
  if (typeof wall === 'string')
    throw new SectorAccessError(
      `a wall written as a name (${JSON.stringify(wall)}) cannot be held by an af-sector level`,
    )
  return wall === undefined ? [x, z] : [x, z, wall]
}

function afEntry(sector: EditSector): AfSectorEntry {
  const { corners, holes, ...rest } = sector
  return {
    ...rest,
    corners: corners.map(afCorner),
    ...(holes === undefined ? {} : { holes: holes.map((hole) => hole.map(afCorner)) }),
  }
}

export const afSectorAccess: SectorAccess<AfSector> = {
  list: (level) => level.sectors,
  withSectors(level, sectors) {
    if (sectors.length === level.sectors.length && sectors.every((sector, i) => sector === level.sectors[i]))
      return level
    const own = new Map<EditSector, AfSectorEntry>(level.sectors.map((entry) => [entry, entry]))
    return { ...level, sectors: sectors.map((sector) => own.get(sector) ?? afEntry(sector)) }
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
  references(level, id) {
    const found = portalReferences(level.sectors, id, 'sector', (wall) =>
      typeof wall === 'object' ? wall.next : undefined,
    )
    const sector = level.sectors.find((each) => each.id === id)
    if (sector === undefined) return found
    for (const entity of level.entities ?? [])
      if (insideOutline(entity.x, entity.z, sector.corners, sector.holes))
        found.push(`entity ${entity.id} stands in it`)
    return found
  },
}
