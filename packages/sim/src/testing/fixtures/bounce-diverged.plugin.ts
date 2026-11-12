// The bounce fixture's twin for the divergence test (exit 7): the same definitions, so the same schema hash,
// but its move system adds 1 to ball 2's vx in the step it runs with ctx.tick === 136. The first hash that
// differs is therefore the one at tick 137 (the numbering of the hash timeline).
import { definePlugin, type PluginDef } from '@automata/sim'
import { Kick } from './bounce.command.ts'
import { Ball } from './bounce.component.ts'
import { BounceStats } from './bounce.resource.ts'
import { BounceKick, BounceSpawn, moveSystem } from './bounce.system.ts'

export const BOUNCE_DIVERGE_TICK = 136
export const BOUNCE_DIVERGE_SID = 2

export const bounceDivergedPlugin: PluginDef = definePlugin({
  name: 'bounce',
  components: [Ball],
  commands: [Kick],
  resources: [BounceStats],
  systems: [BounceKick, moveSystem({ tick: BOUNCE_DIVERGE_TICK, sid: BOUNCE_DIVERGE_SID }), BounceSpawn],
})
