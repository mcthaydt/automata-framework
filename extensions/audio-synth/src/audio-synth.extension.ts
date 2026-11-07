// `audio-synth` as an extension a game opts into (M6 spec §4.10). Presentation only: no sim plugin, so a game's sim hash is the
// same with or without it. The offline render, `pipe audio check` and the board panel join it in M6.10b.
import { defineExtension, type ExtensionDef } from '@mcthaydt/automata-runtime/extension'
import { audioContent } from './audio.content'

export const audioSynthExtension: ExtensionDef<'audio-synth'> = defineExtension({
  name: 'audio-synth',
  content: [audioContent],
})
