// The `af-sector/1` format as a level profile: the codec, the geometry of the sectors it builds (it has no nav graph),
// and its checks.
import type { AfSector } from '../format/af-sector.schema'
import { afSectorChecks } from './af-sector/af-checks'
import { afSectorCodec } from './af-sector/af-codec'
import { afSectorAccess } from './af-sector/af-sectors'
import { AfBuildError, buildSectors } from './af-sector/build'
import { GeometryError, type LevelProfile, resolveOrThrow } from './level-profile'

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
  sectors: afSectorAccess,
}
