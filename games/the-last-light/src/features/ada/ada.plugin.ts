import { CameraHeading, degToHeading, START as START_HEADING } from '@automata/3d/sim'
import { NavAgent } from '@automata/nav/sim'
import { InSector } from '@automata/sectors/sim'
import { definePlugin, type PluginDef, type Sim, type SimContext } from '@automata/sim'
import { atan2 } from '@automata/sim/math'
import { SystemsEnv } from '@automata/systems/sim'
import { Ada } from '../../shared/ada.component.ts'
import type { Start } from '../../shared/play-content.ts'
import { Move } from './move.command.ts'
import { view } from './view.system.ts'
import { face, walk } from './walk.system.ts'

/**
 * Ada's part of the sim: the stick and her facing. It needs the camera's heading, the sectors, nav and the systems. `locked`
 * says a cutscene holds the input (`cutscenes.locked`).
 */
export const adaPlugin = (locked: (ctx: SimContext) => boolean): PluginDef =>
  definePlugin({
    name: 'ada',
    dependsOn: ['camera-heading', 'sectors', 'nav', 'systems'],
    defs: [Ada, Move, walk(locked), face, view],
  })

/** The camera's heading in degrees, 0 looking toward +z: 180 looks toward -z, up the plan. */
const SOUTH_LOOKING_NORTH = 180

/** The speed a tap walks her at: the stick's full push (`WALK_SPEED`), so a tapped walk and a held one match. */
export function spawnAda(sim: Sim, start: Start, speed: number): void {
  const player = sim.spawn([
    [
      Ada,
      {
        // Facing north, away from the camera, as the old spawn did and as the old game's play still shows her after its opening (pi,
        // from the sim's own math: Math.PI is not bit-exact in every engine).
        yaw: atan2(0, -1),
        walking: false,
        lastX: start.x,
        lastZ: start.z,
      },
    ],
    // No view yet: the first tick puts her camera in the view of the room she starts in (`ada.view`). The camera stands south of
    // her, looking north, as the old game's did: pushing the stick up walks her north.
    [CameraHeading, { ...START_HEADING, heading: degToHeading(SOUTH_LOOKING_NORTH) }],
    [InSector, { x: start.x, z: start.z }],
    [NavAgent, { speed }],
  ])
  // The creature senses Ada through her place on the floor plan.
  sim.resource(SystemsEnv).player = player
}
