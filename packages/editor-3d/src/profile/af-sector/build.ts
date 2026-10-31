// An `af-sector/1` level as the engine data the geometry reads (ED3D spec §4.3: for `af-sector`, the geometry owner is
// `build`). It is Last Light's `roomSector` without presets, camera zones or openings: a named style lies under the
// sector's own fields, and the sector's other members are the file's, not the engine's.
import type { AfCorner, AfSector, AfSectorEntry } from '../../format/af-sector.schema'
import type { Corner, SectorDef } from '../../format/sector.schema'

/** The level cannot be built: a sector names a style the file does not have. */
export class AfBuildError extends Error {}

const corner = ([x, z, wall]: AfCorner): Corner => (wall === undefined ? [x, z] : [x, z, wall])

/** The members that hold a value: one that is absent is no member, as in the file. */
function present<T extends object>(members: T): Partial<T> {
  return Object.fromEntries(Object.entries(members).filter(([, value]) => value !== undefined)) as Partial<T>
}

function sectorOf(entry: AfSectorEntry, styles: AfSector['styles']): SectorDef {
  let look: NonNullable<AfSector['styles']>[string] = {}
  if (entry.style !== undefined) {
    const named = styles && Object.hasOwn(styles, entry.style) ? styles[entry.style] : undefined
    if (named === undefined) throw new AfBuildError(`unknown style ${entry.style}`)
    look = named
  }
  // The sector's own members win over the style's, each as a whole (a trim replaces the style's trim).
  const { floorTexture, ceilingTexture, wallTexture, trim } = { ...look, ...entry }
  const sector: SectorDef = {
    id: entry.id,
    zone: '',
    floor: entry.floor,
    ceiling: entry.ceiling,
    light: entry.light,
    ...present({ open: entry.open, floorTexture, ceilingTexture, wallTexture, trim }),
    corners: entry.corners.map(corner),
  }
  if (entry.holes) sector.holes = entry.holes.map((hole) => hole.map(corner))
  return sector
}

export function buildSectors(level: AfSector): SectorDef[] {
  return level.sectors.map((entry) => sectorOf(entry, level.styles))
}
