import { definePlugin, type PluginDef } from '@mcthaydt/automata-sim'
import { CameraHeading } from './camera-heading.component.js'
import { CameraTurn } from './camera-turn.command.js'
import { cameraTurnSystem } from './camera-turn.system.js'

/**
 * The camera's heading in the sim (M3 spec §4.2): the `camera-heading` component, the `camera-turn` command and the
 * system that applies it. A game's own systems enter views (`enterView`) and map the stick (`moveDirection`).
 */
export const cameraHeadingPlugin: PluginDef = definePlugin({
  name: 'camera-heading',
  defs: [CameraHeading, CameraTurn, cameraTurnSystem],
})
