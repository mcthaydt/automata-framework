// The figures extension (M3 spec §4.4.1 `figuresExtension`): it registers the figure and library content
// kinds. It has no sim plugin (figures never feed the sim) and no ui; its renderer is the figure view in
// render-pixi3d (M3.5d).

import { defineExtension, type ExtensionDef } from '@mcthaydt/automata-runtime/extension'
import { FIGURE_CONTENT } from './content/figures.content'

export const figuresExtension: ExtensionDef<'figures'> = defineExtension({
  name: 'figures',
  content: FIGURE_CONTENT,
})
