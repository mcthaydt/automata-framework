// The Audio editor's session: the game's audio file, and what is chosen: a sound, an imported music track, the order the
// music plays in, or the page of what plays when things happen. It also holds the track files the game folder has.

import type { AudioContent } from '@automata/audio-synth'
import { ContentSession } from '../../shared/content-session.svelte.ts'
import type { GameEvent } from '../../shared/game-events.ts'
import type { TomlSession } from '../../shared/toml-session.ts'
import { isCurrent, type SoundFinding, signatureOf } from './audio-findings.ts'

export type AudioChoice =
  | { readonly kind: 'sound'; readonly index: number }
  | { readonly kind: 'track'; readonly index: number }
  | { readonly kind: 'rules' }
  | { readonly kind: 'events' }
  | { readonly kind: 'mix' }

import type { AudioPlay } from '../../shared/audio-play.ts'

/** Checks every sound of the file in the page. Nothing sounds. */
export type AudioCheck = (content: AudioContent) => Promise<SoundFinding[]>

/** What the person is told about a sound's check: not checked yet, checked and as it is now, or changed since. */
export type CheckState = 'unchecked' | 'current' | 'stale'

export class AudioSession extends ContentSession<AudioContent, AudioChoice> {
  readonly play: AudioPlay
  readonly #check: AudioCheck
  /** Whether the page has made a sound yet: until it has, Play says "Tap to hear" (a browser needs a tap first). */
  heard: boolean = $state(false)
  /** The last check: what it found, and every sound as it was then. */
  checked: { findings: readonly SoundFinding[]; signatures: ReadonlyMap<string, string> } | undefined =
    $state()
  checking: boolean = $state(false)
  /** Why the last check could not run. */
  checkFailure: string | undefined = $state()
  /** The sound files in the game folder (music tracks to set up), found when the editor opened. */
  files: readonly string[] = $state([])
  /** What the game can answer, found when the editor opened. */
  readonly events: readonly GameEvent[]
  /** The sound the person looked at last: a new row of "When things happen" starts on it. */
  recent: string | undefined = $state()

  constructor(
    toml: TomlSession<AudioContent>,
    play: AudioPlay,
    check: AudioCheck,
    files: readonly string[] = [],
    events: readonly GameEvent[] = [],
  ) {
    super(toml, { kind: 'sound', index: 0 }, 'Start an audio file')
    this.play = play
    this.#check = check
    this.files = files
    this.events = events
  }

  /** Checks every sound as it is now. A second press while one runs does nothing. */
  async runCheck(): Promise<void> {
    const content = this.content
    if (content === undefined || this.checking) return
    this.checking = true
    this.checkFailure = undefined
    try {
      const findings = await this.#check(content)
      this.checked = { findings, signatures: signatureOf(content) }
    } catch (error) {
      this.checkFailure = `The sounds could not be checked: ${error instanceof Error ? error.message : String(error)}`
    } finally {
      this.checking = false
    }
  }

  checkState(id: string): CheckState {
    const content = this.content
    if (this.checked === undefined || content === undefined) return 'unchecked'
    return isCurrent(content, this.checked.signatures, id)
      ? 'current'
      : this.checked.signatures.has(id)
        ? 'stale'
        : 'unchecked'
  }

  /** What the last check found in the sound called `id`, only while that sound is as it was when checked. */
  findingsFor(id: string): readonly SoundFinding[] {
    return this.checkState(id) === 'current'
      ? (this.checked?.findings.filter((one) => one.sound === id) ?? [])
      : []
  }
}
