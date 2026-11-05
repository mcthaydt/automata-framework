import { definePlugin, type PluginDef } from '@mcthaydt/automata-sim'
import { goal } from './goal.system.ts'
import { Move } from './move.command.ts'
import { Player, PlayerControl } from './player.component.ts'
import { GoalReached, Jumped, Landed } from './player.event.ts'
import { playerInput } from './player-input.system.ts'
import { playerMove } from './player-move.system.ts'
import { Progress } from './progress.resource.ts'

/** The base's whole sim: one character who runs and jumps in a tile room, and a goal. */
export const emberwickPlugin: PluginDef = definePlugin({
  name: 'emberwick',
  components: [Player, PlayerControl],
  commands: [Move],
  events: [Jumped, Landed, GoalReached],
  resources: [Progress],
  systems: [playerInput, playerMove, goal],
})
