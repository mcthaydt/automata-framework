// The core garment set, registered in the garment registry (registry/garment-registry.ts) when this file loads:
// cap, cape, eyes, hair, shoes, top and trousers: what Wick and the base pair wear. Loading it from the figure's
// schema and from `dress` is what makes the set always there. The order is the order a figure's garments are told
// apart in. The rest of a wardrobe is an extension's (`registerGarment`).

import type { CapGarment, Classic, Eyes, Garment, HairGarment } from '../../figure/garment.schema.ts'
import { CLASSIC_SCHEMAS } from '../../figure/garment.schema.ts'
import { registerGarment } from '../../registry/garment-registry.ts'
import { type Dressing, wearClassic } from './classic.ts'
import { wearCap, wearEyes, wearHair } from './head-wear.ts'

/** How a kind is worn: the head and face kinds have their own; every other core kind is `wearClassic`'s. */
const wearOf = (name: string): ((d: Dressing, item: Garment) => void) => {
  if (name === 'hair') return (d, item) => wearHair(d, item as HairGarment)
  if (name === 'cap') return (d, item) => wearCap(d, item as CapGarment)
  if (name === 'eyes') return (d, item) => wearEyes(d, item as Eyes)
  return (d, item) => void wearClassic(d, item as Classic)
}

for (const [name, schema] of Object.entries(CLASSIC_SCHEMAS))
  registerGarment(name, { schema, swatches: {}, wear: wearOf(name) })
