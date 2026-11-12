import { CameraHeading, enterView, START as START_HEADING } from '@automata/3d/sim'
import { NavAgent } from '@automata/nav/sim'
import { InSector } from '@automata/sectors/sim'
import { definePlugin, type PluginDef, type Sim, type SimContext } from '@automata/sim'
import { atan2 } from '@automata/sim/math'
import { SystemsEnv } from '@automata/systems/sim'
import { Ada } from '../../shared/ada.component.ts'
import { FOLLOW } from '../../shared/constants.ts'
import type { Start } from '../../shared/play-content.ts'
import { Move } from './move.command.ts'
import { face, walk } from './walk.system.ts'

/**
 * Ada's part of the sim: the stick and her facing. It needs the camera's heading, the sectors, nav and the systems. `locked`
 * says a cutscene holds the input (`cutscenes.locked`).
 */
export const adaPlugin = (locked: (ctx: SimContext) => boolean): PluginDef =>
  definePlugin({
    name: 'ada',
    dependsOn: ['camera-heading', 'sectors', 'nav', 'systems'],
    defs: [Ada, Move, walk(locked), face],
  })

/** The speed a tap walks her at: the stick's full push (`WALK_SPEED`), so a tapped walk and a held one match. */
export function spawnAda(sim: Sim, start: Start, speed: number): void {
  const player = sim.spawn([
    [
      Ada,
      {
        // Facing south, toward the camera, as the old spawn did (pi, from the sim's own math: Math.PI is not bit-exact in every engine).
        yaw: atan2(0, -1),
        walking: false,
        lastX: start.x,
        lastZ: start.z,
      },
    ],
    [CameraHeading, enterView(START_HEADING, FOLLOW, { x: 0, y: 0 })],
    [InSector, { x: start.x, z: start.z }],
    [NavAgent, { speed }],
  ])
  // The creature senses Ada through her place on the floor plan.
  sim.resource(SystemsEnv).player = player
}
