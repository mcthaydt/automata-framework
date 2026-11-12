import { definePlugin, type PluginDef, type SimContext } from '@automata/sim'
import { restoreAfterFound } from './catch.system.ts'
import { Checkpoint } from './checkpoint.resource.ts'

/** The catch's part of the sim: the one checkpoint, and the restore when a catch's cutscene has ended. */
export const catchPlugin = (playing: (ctx: SimContext) => boolean): PluginDef =>
  definePlugin({
    name: 'catch',
    dependsOn: ['systems', 'puzzle', 'nav'],
    defs: [Checkpoint, restoreAfterFound(playing)],
  })
