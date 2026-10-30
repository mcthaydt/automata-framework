// The `af-sector/1` format as a level profile: the codec, the geometry of the sectors it builds (it has no nav graph),
// its checks, and the entities the file defines and holds.
import type { AfSector } from '../format/af-sector.schema'
import { afSectorChecks } from './af-sector/af-checks'
import { afSectorCodec } from './af-sector/af-codec'
import { afEntityKit } from './af-sector/af-entities'
import { afSectorAccess } from './af-sector/af-sectors'
import { afThingAccess } from './af-sector/af-things'
import { AfBuildError, buildSectors } from './af-sector/build'
import { SECTOR_HINTS } from './level-hints'
import { GeometryError, type LevelProfile, resolveOrThrow } from './level-profile'
import { afMaterials } from './materials'

export const afSectorProfile: LevelProfile<AfSector> = {
  ...afSectorCodec,
  geometry(level) {
    let sectors: ReturnType<typeof buildSectors>
    try {
      sectors = buildSectors(level)
    } catch (error) {
      if (error instanceof AfBuildError) throw new GeometryError(error.message)
      throw error
    }
    return { layers: [{ kind: 'sectors', map: resolveOrThrow(sectors) }] }
  },
  checks: (level) => afSectorChecks(level),
  entities: afEntityKit,
  sectors: afSectorAccess,
  things: afThingAccess,
  materials: (level) => afMaterials(level),
  hints: SECTOR_HINTS,
}
