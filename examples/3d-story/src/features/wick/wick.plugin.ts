import { CameraHeading, enterView, START } from '@automata/3d/sim'
import { InSector } from '@automata/sectors/sim'
import { definePlugin, type PluginDef, type Sim } from '@automata/sim'
import { SystemsEnv } from '@automata/systems/sim'
import { FOLLOW } from '../../shared/constants.ts'
import type { Room } from '../../shared/read-room.ts'
import { Move } from './move.command.ts'
import { walk } from './walk.system.ts'
import { Wick } from './wick.component.ts'

/** Wick's part of the sim: what he holds, what he hears and what runs each tick. It needs the camera's heading and the sectors. */
export const wickPlugin: PluginDef = definePlugin({
  name: 'wick',
  dependsOn: ['camera-heading', 'sectors', 'systems'],
  defs: [Wick, Move, walk],
})

/**
 * Puts Wick on the room's start point, facing away from the camera, with the camera on him, and tells the systems he is
 * the player: the characters sense him through his place on the floor plan.
 */
export function spawnWick(sim: Sim, room: Room): void {
  const player = sim.spawn([
    [Wick, { x: room.start.x, y: 0, z: room.start.z, yaw: 0, walking: false }],
    [CameraHeading, enterView(START, FOLLOW, { x: 0, y: 0 })],
    [InSector, { x: room.start.x, z: room.start.z }],
  ])
  sim.resource(SystemsEnv).player = player
}
