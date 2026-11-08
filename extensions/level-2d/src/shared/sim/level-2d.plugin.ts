import { definePlugin, type PluginDef } from '@automata/sim'
import { Level2dAt } from './level-2d.component.ts'

/** The sim side of `level-2d`: the position component a game with none of its own uses. */
export const level2dPlugin: PluginDef = definePlugin({ name: 'level-2d', components: [Level2dAt] })
