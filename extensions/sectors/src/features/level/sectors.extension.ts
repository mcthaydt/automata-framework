// `sectors` as an extension a game opts into: the sim plugin and the `sector-map` content kind.
import { defineExtension, type ExtensionDef } from '@automata/framework/extension'
import { sectorsPlugin } from '../../shared/sim/sectors.plugin'
import { sectorMapContent } from './sector-map.content'

export const sectorsExtension: ExtensionDef<'sectors'> = defineExtension({
  name: 'sectors',
  sim: [sectorsPlugin],
  content: [sectorMapContent],
})
