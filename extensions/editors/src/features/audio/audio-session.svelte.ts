// The Audio editor's session: the game's audio file, and what is chosen: a sound, an imported music track, the order the
// music plays in, or the page of what plays when things happen. It also holds the track files the game folder has.

import type { AudioContent } from '@automata/audio-synth'
import { ContentSession } from '../../shared/content-session.svelte.ts'
import type { GameEvent } from '../../shared/game-events.ts'
import type { TomlSession } from '../../shared/toml-session.ts'

export type AudioChoice =
  | { readonly kind: 'sound'; readonly index: number }
  | { readonly kind: 'track'; readonly index: number }
  | { readonly kind: 'rules' }
  | { readonly kind: 'events' }

import type { AudioPlay } from '../../shared/audio-play.ts'

export class AudioSession extends ContentSession<AudioContent, AudioChoice> {
  readonly play: AudioPlay
  /** The sound files in the game folder (music tracks to set up), found when the editor opened. */
  files: readonly string[] = $state([])
  /** What the game can answer, found when the editor opened. */
  readonly events: readonly GameEvent[]
  /** The sound the person looked at last: a new row of "When things happen" starts on it. */
  recent: string | undefined = $state()

  constructor(
    toml: TomlSession<AudioContent>,
    play: AudioPlay,
    files: readonly string[] = [],
    events: readonly GameEvent[] = [],
  ) {
    super(toml, { kind: 'sound', index: 0 }, 'Start an audio file')
    this.play = play
    this.files = files
    this.events = events
  }
}
