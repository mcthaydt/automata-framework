import { definePlugin, type PluginDef } from '@automata/sim'
import { CameraYaw } from './camera-yaw.command.ts'
import { cameraYawSystem } from './camera-yaw.system.ts'

/**
 * The free camera turn, opt-in: the `camera-yaw` command and the system that applies it to `camera-heading`. A game that wants
 * an ordinary third-person camera (a right stick, a swipe, a mouse drag turning it smoothly) adds this to its sim's plugins
 * beside `camera-heading`. It is its own plugin because the sim's schema hash names every command: a game without it keeps
 * its recorded hashes.
 */
export const cameraYawPlugin: PluginDef = definePlugin({
  name: 'camera-yaw',
  dependsOn: ['camera-heading'],
  defs: [CameraYaw, cameraYawSystem],
})
