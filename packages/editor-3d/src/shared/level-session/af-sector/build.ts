// An `af-sector/2` level as the engine data the geometry reads (ED3D spec §4.3: for `af-sector`, the geometry owner is
// `build`). It is Last Light's `roomSector` without presets, camera zones or openings: a named style lies under the
// sector's own fields, and the sector's other members are the file's, not the engine's. The rooms come as the editor
// sees them (heights, and a wall's texture as a name), so what is drawn is what the edits change.
import type { AfSector2File, Corner, SectorDef, WallDef } from '@automata/3d/level'
import type { EditCorner } from '../sector-access'
import { afSectorAccess } from './af-sectors'

/** The level cannot be built: a sector names a style the file does not have. */
export class AfBuildError extends Error {}

// A view's walls are never names; the engine reads the members it knows and ignores the rest.
const corner = ([x, z, wall]: EditCorner): Corner => (wall === undefined ? [x, z] : [x, z, wall as WallDef])

/** The members that hold a value: one that is absent is no member, as in the file. */
function present<T extends object>(members: T): Partial<T> {
  return Object.fromEntries(Object.entries(members).filter(([, value]) => value !== undefined)) as Partial<T>
}

function sectorOf(
  entry: ReturnType<typeof afSectorAccess.list>[number],
  styles: AfSector2File['styles'],
): SectorDef {
  let look: NonNullable<AfSector2File['styles']>[string] = {}
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

export function buildSectors(level: AfSector2File): SectorDef[] {
  return afSectorAccess.list(level).map((entry) => sectorOf(entry, level.styles))
}
