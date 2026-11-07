import { definePlugin, type PluginDef } from '@automata/sim'
import { CameraHeading } from './camera-heading.component.ts'
import { CameraTurn } from './camera-turn.command.ts'
import { cameraTurnSystem } from './camera-turn.system.ts'

/**
 * The camera's heading in the sim: the `camera-heading` component, the `camera-turn` command and the
 * system that applies it. A game's own systems enter views (`enterView`) and map the stick (`moveDirection`).
 */
export const cameraHeadingPlugin: PluginDef = definePlugin({
  name: 'camera-heading',
  defs: [CameraHeading, CameraTurn, cameraTurnSystem],
})
