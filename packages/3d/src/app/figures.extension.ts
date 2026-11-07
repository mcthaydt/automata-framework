// The figures extension (M3 spec §4.4.1 `figuresExtension`): it registers the figure and library content
// kinds. It has no sim plugin (figures never feed the sim) and no ui; its renderer is the figure view in
// @automata/3d (M3.5d).

import { defineExtension, type ExtensionDef } from '@automata/framework/extension'
// The classic garment set registers when this file loads (core, so Wick needs no wardrobe of his own); an
// extension's own garments register the same way, through `registerGarment` from `@automata/3d/figures`.
import '../features/figures/outfit/garments/classic-kinds.ts'
import { FIGURE_CONTENT } from '../features/figures/content/figures.content.ts'

export const figuresExtension: ExtensionDef<'figures'> = defineExtension({
  name: 'figures',
  content: FIGURE_CONTENT,
})
