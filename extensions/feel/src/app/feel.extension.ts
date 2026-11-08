// `feel` as an extension a game opts into. It is presentation only: no sim plugin, so a game's sim hash is the
// same with or without it. The renderer channels, the haptics port and the FeelSection join it later.
import { defineExtension, type ExtensionDef } from '@automata/framework/extension'
import { feelContent } from '../features/frame/feel.content'

/**
 * The feel extension a game opts into. It is presentation only and adds no sim plugin, so a game's
 * sim hash is the same with or without it.
 */
export const feelExtension: ExtensionDef<'feel'> = defineExtension({
  name: 'feel',
  content: [feelContent],
})
