// @automata/sectors/sim: the sector map's sim side (M6 spec §4.3), a sim entry. The map's shape is the sector
// format's (`Point` is re-exported from it, §3); resolution, queries, the step rule and the plugin are sectors' own.
export type { Point } from '@automata/3d/level'
export { loadSectorMap } from './load-sector-map'
export { type Collider, type Edge, type Piece, type ResolvedMap, resolveMap, type Sector } from './resolve'
export { resolvedMap } from './resolved-map'
export { type SectorMap, sectorMapSchema } from './sector-map.schema'
export { InSector } from './sectors.component'
export {
  SectorEntered,
  type SectorEnteredPayload,
  ZoneCrossed,
  type ZoneCrossedPayload,
} from './sectors.event'
export { sectorsPlugin } from './sectors.plugin'
export { SectorMapResource } from './sectors.resource'
