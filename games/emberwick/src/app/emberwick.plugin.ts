import { definePlugin, type PluginDef } from '@mcthaydt/automata-sim'
import { goal } from '../features/goal/goal.system.ts'
import { Progress } from '../features/goal/progress.resource.ts'
import { Move } from '../features/player/move.command.ts'
import { playerInput } from '../features/player/player-input.system.ts'
import { playerMove } from '../features/player/player-move.system.ts'
import { Player, PlayerControl } from '../shared/player.component.ts'
import { GoalReached, Jumped, Landed } from '../shared/player.event.ts'

/** The base's whole sim: one character who runs and jumps in a tile room, and a goal. */
export const emberwickPlugin: PluginDef = definePlugin({
  name: 'emberwick',
  components: [Player, PlayerControl],
  commands: [Move],
  events: [Jumped, Landed, GoalReached],
  resources: [Progress],
  systems: [playerInput, playerMove, goal],
})
