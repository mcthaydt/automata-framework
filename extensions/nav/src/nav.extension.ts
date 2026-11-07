// `nav` as an extension a game opts into: the sim plugin and the `nav-graph` content kind. It needs `sectors`.
import { defineExtension, type ExtensionDef } from '@automata/framework/extension'
import { navGraphContent } from './nav-graph.content'
import { navPlugin } from './sim/nav.plugin'

export const navExtension: ExtensionDef<'nav'> = defineExtension({
  name: 'nav',
  requires: ['sectors'],
  sim: [navPlugin],
  content: [navGraphContent],
})
