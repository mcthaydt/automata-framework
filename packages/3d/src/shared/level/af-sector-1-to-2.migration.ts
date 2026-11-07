// `af-sector/1` to `/2` (spec 9). Lossless: every member of the old file is in the new one, a number for a plane
// becomes `{ z }`, and a wall's `texture` becomes its `surface`. The pit that base-3d's room used to mean by a floor
// below 0 is not guessed here; the game's own file says `pit: true`.
import type { AfCorner, AfSector, AfSectorEntry } from './af-sector.schema.ts'
import {
  AF_SECTOR_2_FORMAT,
  type AfCorner2,
  type AfSector2,
  type AfSectorEntry2,
  type AfWall2,
} from './af-sector-2.schema.ts'

function migrateCorner(corner: AfCorner): AfCorner2 {
  const [x, z, wall] = corner
  if (wall === undefined) return [x, z]
  const { texture, ...rest } = wall
  // A wall already saying `surface` keeps it; `texture` was the only way /1 said it.
  const migrated: AfWall2 =
    texture !== undefined && !('surface' in rest) ? { ...rest, surface: texture } : rest
  return [x, z, migrated]
}

function migrateSector(sector: AfSectorEntry): AfSectorEntry2 {
  const { floor, ceiling, corners, holes, ...rest } = sector
  return {
    ...rest,
    floor: { z: floor },
    ceiling: { z: ceiling },
    corners: corners.map(migrateCorner),
    ...(holes === undefined ? {} : { holes: holes.map((hole) => hole.map(migrateCorner)) }),
  }
}

/** A `/1` level as `/2`. Pure: the input is not changed, and a member it does not know comes along. */
export function migrateAfSector1(level: AfSector): AfSector2 {
  return { ...level, format: AF_SECTOR_2_FORMAT, sectors: level.sectors.map(migrateSector) }
}
