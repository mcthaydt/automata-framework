// @automata/sectors/sim: the level's sim side, a sim entry. The level's shape is `af-sector/2`'s (`Point` is
// re-exported from it); the checks, resolution, queries and the plugin are sectors' own.
export type { Point } from '@automata/3d/level'
export { checkLevel, type SectorMap, type StoredPlane, type StoredSector } from '../shared/sim/check-level'
export { loadSectorMap } from '../shared/sim/load-sector-map'
export { readSectorMap, type SectorMapRead } from '../shared/sim/read-sector-map'
export {
  type Collider,
  type Edge,
  type Piece,
  type ResolvedMap,
  resolveLevel,
  type Sector,
} from '../shared/sim/resolve'
export { resolvedMap } from '../shared/sim/resolved-map'
export { InSector } from '../shared/sim/sectors.component'
export {
  SectorEntered,
  type SectorEnteredPayload,
  ZoneCrossed,
  type ZoneCrossedPayload,
} from '../shared/sim/sectors.event'
export { sectorsPlugin } from '../shared/sim/sectors.plugin'
export { SectorMapResource } from '../shared/sim/sectors.resource'
