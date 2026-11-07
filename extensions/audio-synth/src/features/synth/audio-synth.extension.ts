// `audio-synth` as an extension a game opts into. Presentation only: no sim plugin, so a game's sim hash is the
// same with or without it. The offline render, `pipe audio check` and the board panel join it later.
import { defineExtension, type ExtensionDef } from '@automata/framework/extension'
import { audioContent } from './audio.content'

/** The audio-synth extension a game opts into. It registers the `audio` content kind. */
export const audioSynthExtension: ExtensionDef<'audio-synth'> = defineExtension({
  name: 'audio-synth',
  content: [audioContent],
})
