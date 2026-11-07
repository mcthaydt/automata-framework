// The `sector-map` resource: the scene's map as content gives it, set once per scene by `loadSectorMap`. It is what a
// snapshot carries; the resolution is derived from it (`resolvedMap`), so it never needs saving.
import { defineResource, type ResourceDef } from '@mcthaydt/automata-sim'
import { sectorMapSchema } from './sector-map.schema'

/** The scene's sector map; empty until the game loads one. */
export const SectorMapResource: ResourceDef<typeof sectorMapSchema> = defineResource(
  'sectors.sector-map',
  sectorMapSchema,
  () => ({ sectors: [] }),
)
