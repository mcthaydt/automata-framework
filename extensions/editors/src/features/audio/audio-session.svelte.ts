// The Audio editor's session: the game's audio file, and what is chosen: a sound, an imported music track, the order the
// music plays in, or the page of what plays when things happen. It also holds the track files the game folder has.
import type { AudioContent } from '@automata/audio-synth'
import { ContentSession } from '../../shared/content-session.svelte.ts'
import type { TomlSession } from '../../shared/toml-session.ts'

export type AudioChoice =
  | { readonly kind: 'sound'; readonly index: number }
  | { readonly kind: 'track'; readonly index: number }
  | { readonly kind: 'rules' }
  | { readonly kind: 'events' }

/** What a Play press asks the page to sound: the file as it is now, and which sound. */
export type AudioPlay = (
  content: AudioContent,
  what: { readonly kind: 'sound'; readonly id: string },
) => Promise<void>

export class AudioSession extends ContentSession<AudioContent, AudioChoice> {
  readonly play: AudioPlay
  /** The sound files in the game folder (music tracks to set up), found when the editor opened. */
  files: readonly string[] = $state([])

  constructor(toml: TomlSession<AudioContent>, play: AudioPlay, files: readonly string[] = []) {
    super(toml, { kind: 'sound', index: 0 }, 'Start an audio file')
    this.play = play
    this.files = files
  }
}
