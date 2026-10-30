// The render-pixi3d extension (M3 spec §4.1, §4.2 `render3dExtension`). The renderer is chosen with `createRenderer`,
// models arrive through the game's preload, and ruken.toml's `runtime.renderer` stays `webgl2` (Ruken has no WebGPU
// value). It brings the camera's `camera-view` content and the heading's sim plugin (`./sim`), and the room's
// `scene-lighting` content (M3.4d).
import { defineExtension, type ExtensionDef } from '@mcthaydt/automata-runtime/extension'
import { cameraViewContent } from './camera/camera-view.content.js'
import { sceneLightingContent } from './light/scene-lighting.content.js'
import { cameraHeadingPlugin } from './sim/camera-heading.plugin.js'

export const render3dExtension: ExtensionDef<'render-pixi3d'> = defineExtension({
  name: 'render-pixi3d',
  sim: [cameraHeadingPlugin],
  content: [cameraViewContent, sceneLightingContent],
})
