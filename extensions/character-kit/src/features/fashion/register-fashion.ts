// Registers the runway's wardrobe on the figure builder, once: its fabrics (H5), its swatches merged into the builder's
// `SWATCHES`, its hair styles merged into `HAIR_STYLES` and its `silk` finish (H4). The builder throws on a fabric or a finish
// named twice, so this is guarded and safe to call again (two games in one page, a hot reload); a name the builder's own
// tables already hold is a thrown error naming it, never an overwrite. Nothing here is the builder's base, and nothing is
// added to its sources.
import { HAIR_STYLES, registerFabric, registerFinish, SWATCHES } from '../../shared/figure-builder/door.ts'
import { FABRICS } from './fabrics.ts'
import { FASHION_HAIR, SILK } from './hair.ts'
import { FASHION_SWATCHES } from './swatches.ts'

let registered = false

/** Adds the fashion kit to the builder, the first time only. */
export function registerFashion(): void {
  if (registered) return
  for (const name of Object.keys(FASHION_SWATCHES)) {
    if (name in SWATCHES)
      throw new Error(`The fashion swatch "${name}" is already one of the figure builder's.`)
  }
  for (const name of Object.keys(FASHION_HAIR)) {
    if (name in HAIR_STYLES)
      throw new Error(`The fashion hair style "${name}" is already one of the figure builder's.`)
  }
  for (const [name, fabric] of Object.entries(FABRICS)) registerFabric(name, fabric)
  registerFinish('silk', SILK)
  Object.assign(SWATCHES, FASHION_SWATCHES)
  Object.assign(HAIR_STYLES, FASHION_HAIR)
  registered = true
}
