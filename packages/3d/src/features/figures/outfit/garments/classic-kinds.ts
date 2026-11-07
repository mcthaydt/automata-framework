// The classic garment set, registered in the garment registry (registry/garment-registry.ts) when this file loads:
// apron, belt, cap, cape, coat, eyes, gloves, hair, legs, mark, shoes, skirt, top, trousers and waistcoat. It is
// core, so Wick needs no extension of his own; loading it from the figure's schema and from `dress` is what
// makes the set always there. The order is the order a figure's garments are told apart in (a cap's `mark` is
// the cap's, so `cap` comes before `mark`).

import type { CapGarment, Classic, Eyes, Garment, HairGarment } from '../../figure/garment.schema.ts'
import { CLASSIC_SCHEMAS } from '../../figure/garment.schema.ts'
import { registerGarment } from '../../registry/garment-registry.ts'
import { type Dressing, wearClassic } from './classic.ts'
import { wearCap, wearEyes, wearHair } from './head-wear.ts'

/** How a kind is worn: the head and face kinds have their own; every other classic kind is `wearClassic`'s. */
const wearOf = (name: string): ((d: Dressing, item: Garment) => void) => {
  if (name === 'hair') return (d, item) => wearHair(d, item as HairGarment)
  if (name === 'cap') return (d, item) => wearCap(d, item as CapGarment)
  if (name === 'eyes') return (d, item) => wearEyes(d, item as Eyes)
  return (d, item) => void wearClassic(d, item as Classic)
}

for (const [name, schema] of Object.entries(CLASSIC_SCHEMAS))
  registerGarment(name, { schema, swatches: {}, wear: wearOf(name) })
