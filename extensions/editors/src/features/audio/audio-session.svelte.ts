// The Audio editor's session: the game's audio file, and what is chosen: a sound, a music bed, or the page of what plays
// when things happen.
import type { AudioContent } from '@automata/audio-synth'
import { ContentSession } from '../../shared/content-session.svelte.ts'
import type { TomlSession } from '../../shared/toml-session.ts'

export type AudioChoice =
  | { readonly kind: 'sound'; readonly index: number }
  | { readonly kind: 'bed'; readonly index: number }
  | { readonly kind: 'events' }

/** What a Play press asks the page to sound: the file as it is now, and which sound or bed. */
export type AudioPlay = (
  content: AudioContent,
  what: { readonly kind: 'sound' | 'bed'; readonly id: string },
) => Promise<void>

export class AudioSession extends ContentSession<AudioContent, AudioChoice> {
  readonly play: AudioPlay

  constructor(toml: TomlSession<AudioContent>, play: AudioPlay) {
    super(toml, { kind: 'sound', index: 0 }, 'Start an audio file')
    this.play = play
  }
}
