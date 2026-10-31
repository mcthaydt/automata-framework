// The `sector-map` content kind: every TOML file in `content/maps` is one scene's map, checked by `sectorMapSchema`.
import { type ContentSchemaDef, defineContentSchema } from '@mcthaydt/automata-content'
import { type SectorMap, sectorMapSchema } from './sim/sector-map.schema'

export const sectorMapContent: ContentSchemaDef<'sector-map', typeof sectorMapSchema> = defineContentSchema(
  'sector-map',
  sectorMapSchema,
  { folder: 'maps' },
)
export type { SectorMap }
