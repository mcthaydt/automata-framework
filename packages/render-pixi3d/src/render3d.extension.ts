// The render-pixi3d extension (M3 spec §4.1 `render3dExtension`): the renderer is chosen with `createRenderer`,
// models arrive through the game's preload, and ruken.toml's `runtime.renderer` stays `webgl2` (Ruken has no WebGPU
// value). It registers the `scene-lighting` content kind (M3.4d). The camera's `camera-view` content and its sim
// entry join in M3.4b.
import { defineExtension, type ExtensionDef } from '@mcthaydt/automata-runtime/extension'
import { sceneLightingContent } from './light/scene-lighting-kind.js'

export const render3dExtension: ExtensionDef<'render-pixi3d'> = defineExtension({
  name: 'render-pixi3d',
  content: [sceneLightingContent],
})
