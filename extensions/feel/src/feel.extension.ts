// `feel` as an extension a game opts into (M6 spec §4.1). It is presentation only: no sim plugin, so a game's sim hash is the
// same with or without it. The renderer channels, the haptics port and the FeelSection join it in M6.1b and M6.1c.
import { defineExtension, type ExtensionDef } from '@automata/framework/extension'
import { feelContent } from './feel.content'

export const feelExtension: ExtensionDef<'feel'> = defineExtension({
  name: 'feel',
  content: [feelContent],
})
