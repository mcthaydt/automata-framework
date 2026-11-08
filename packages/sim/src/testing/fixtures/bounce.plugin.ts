// The bounce fixture: integer-math balls in a box, with RNG spawns, a resource and a command.
import { definePlugin, type PluginDef } from '@mcthaydt/automata-sim'
import { Kick } from './bounce.command'
import { Ball } from './bounce.component'
import { BounceStats } from './bounce.resource'
import { BounceKick, BounceMove, BounceSpawn } from './bounce.system'

export const bouncePlugin: PluginDef = definePlugin({
  name: 'bounce',
  components: [Ball],
  commands: [Kick],
  resources: [BounceStats],
  systems: [BounceKick, BounceMove, BounceSpawn],
})
