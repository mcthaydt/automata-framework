// @automata/sectors/sim: the sector map's sim side, a sim entry. The map's shape is the sector
// format's (`Point` is re-exported from it); resolution, queries, the step rule and the plugin are sectors' own.
export type { Point } from '@automata/3d/level'
export { loadSectorMap } from '../shared/sim/load-sector-map'
export {
  type Collider,
  type Edge,
  type Piece,
  type ResolvedMap,
  resolveMap,
  type Sector,
} from '../shared/sim/resolve'
export { resolvedMap } from '../shared/sim/resolved-map'
export { type SectorMap, sectorMapSchema } from '../shared/sim/sector-map.schema'
export { InSector } from '../shared/sim/sectors.component'
export {
  SectorEntered,
  type SectorEnteredPayload,
  ZoneCrossed,
  type ZoneCrossedPayload,
} from '../shared/sim/sectors.event'
export { sectorsPlugin } from '../shared/sim/sectors.plugin'
export { SectorMapResource } from '../shared/sim/sectors.resource'
