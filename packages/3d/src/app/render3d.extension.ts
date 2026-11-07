// The @automata/3d extension (M3 spec §4.1, §4.2 `render3dExtension`). The renderer is chosen with `createRenderer`,
// models arrive through the game's preload, and ruken.toml's `runtime.renderer` stays `webgl2` (Ruken has no WebGPU
// value). It brings the camera's `camera-view` content and the heading's sim plugin (`./sim`), and the room's
// `scene-lighting` content (M3.4d) and the `time-of-day` content a level names.
import { defineExtension, type ExtensionDef } from '@automata/framework/extension'
import { cameraViewContent } from '../features/camera/camera-view.content.ts'
import { cameraHeadingPlugin } from '../features/camera/sim/camera-heading.plugin.ts'
import { sceneLightingContent } from '../shared/render/light/scene-lighting.content.ts'
import { timeOfDayContent } from '../shared/time-of-day/time-of-day.content.ts'

export const render3dExtension: ExtensionDef<'3d'> = defineExtension({
  name: '3d',
  sim: [cameraHeadingPlugin],
  content: [cameraViewContent, sceneLightingContent, timeOfDayContent],
})
