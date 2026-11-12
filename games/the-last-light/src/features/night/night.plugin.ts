import { definePlugin, type PluginDef, type SimContext } from '@automata/sim'
import { Night } from './night.resource.ts'
import { rouse } from './rouse.system.ts'
import { type Hear, steps } from './steps.system.ts'

/** The night's part of the sim: the vigil's clock, whether it is over, and Ada's footsteps as noise. */
export const nightPlugin = (hear: Hear, playing: (ctx: SimContext) => boolean): PluginDef =>
  definePlugin({ name: 'night', dependsOn: ['systems'], defs: [Night, steps(hear), rouse(playing)] })
