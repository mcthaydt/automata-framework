// The streetwear wardrobe: eleven garments (tee, hoodie, puffer, jacket, bomber, wide-legs, cargos, sneakers, chain,
// hoops, shades) for the procedural figures, as an extension. It is the worked example of a wardrobe: core's
// builder of figures knows only the 15 classic garments, and this registers the rest the way any game's own wardrobe
// would (`registerGarment` from `@automata/3d/figures-kit`), then sets the outfit hook that picks the openings a
// hand can reach.
//
// An extension has no setup hook, so the kinds register when this file's garments load: add the extension to a
// game's `extensions` and the figures' schema and `dress` see them. Without it a figure naming a bomber is
// refused ("a garment has one of: …" when the figure file compiles, "No garment called bomber is registered" when
// one is dressed).

import { defineExtension, type ExtensionDef } from '@automata/framework/extension'
import './garments/streetwear-kinds.ts'

const wardrobeExtension: ExtensionDef<'wardrobe'> = defineExtension({
  name: 'wardrobe',
  requires: ['figures'],
})

export default wardrobeExtension
