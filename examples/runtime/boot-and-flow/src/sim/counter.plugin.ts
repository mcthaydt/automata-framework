import { definePlugin, type PluginDef } from '@mcthaydt/automata-sim'
import { countSystem } from './count.system.ts'
import { Tick } from './counter.event.ts'
import { Counter } from './counter.resource.ts'

export const counterPlugin: PluginDef = definePlugin({
  name: 'counter',
  events: [Tick],
  resources: [Counter],
  systems: [countSystem],
})
