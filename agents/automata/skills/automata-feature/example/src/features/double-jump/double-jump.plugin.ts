import { definePlugin, type PluginDef } from '@automataframework/automata-sim'
import { Body } from './body.component.ts'
import { doubleJump } from './double-jump.system.ts'
import { Jump } from './jump.command.ts'

/** The example's whole sim: register every definition once, in a plugin. */
export const doubleJumpPlugin: PluginDef = definePlugin({
  name: 'double-jump',
  components: [Body],
  commands: [Jump],
  systems: [doubleJump],
})
