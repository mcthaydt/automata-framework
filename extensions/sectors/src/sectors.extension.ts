// `sectors` as an extension a game opts into: the sim plugin and the `sector-map` content kind.
import { defineExtension, type ExtensionDef } from '@automata/framework/extension'
import { sectorMapContent } from './sector-map.content'
import { sectorsPlugin } from './sim/sectors.plugin'

export const sectorsExtension: ExtensionDef<'sectors'> = defineExtension({
  name: 'sectors',
  sim: [sectorsPlugin],
  content: [sectorMapContent],
})
