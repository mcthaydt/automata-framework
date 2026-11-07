// `sectors` as an extension a game opts into: the sim plugin. The level it reads is the game's `af-sector/2` file,
// which the game loads through `readLevel` and hands to `loadSectorMap`; it adds no content kind of its own.
import { defineExtension, type ExtensionDef } from '@automata/framework/extension'
import { sectorsPlugin } from '../../shared/sim/sectors.plugin'

export const sectorsExtension: ExtensionDef<'sectors'> = defineExtension({
  name: 'sectors',
  sim: [sectorsPlugin],
})
