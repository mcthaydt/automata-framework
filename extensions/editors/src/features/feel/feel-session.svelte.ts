// Feel's session: the game's feel file, which feel is chosen (an entry's index, or `'limits'` for the "Never more
// than" page), the events the game offers to answer, the sounds it has, and the stage's preview: the player's settings,
// which never touch the file.

import type { ContentEdit } from '@automata/editor/kit/documents'
import { DEFAULT_SETTINGS, type FeelContent, type FeelSettings } from '@automata/feel'
import { ContentSession } from '../../shared/content-session.svelte.ts'
import type { GameEvent } from '../../shared/game-events.ts'
import type { Outcome, TomlSession } from '../../shared/toml-session.ts'
import type { StageOutputs } from './feel-stage.ts'

export type Preview = FeelSettings & { readonly reduced: boolean }

export interface FeelExtras {
  readonly events?: readonly GameEvent[]
  /** The sound ids the game has (its audio files' cues). */
  readonly cues?: readonly string[]
  /** What the device can rumble with; its sounds are `play`'s. */
  readonly outputs?: StageOutputs
  /** Plays one of the game's sounds through the audio the page makes (the Audio editor's player over the game's audio file). */
  readonly play?: (cue: string) => void
}

export class FeelSession extends ContentSession<FeelContent, number | 'limits'> {
  /** The game's code has the part that plays what this editor makes, found when the editor opened. */
  hasPlayer = true
  /** What the game can answer, best first; read when the editor opened. */
  readonly events: readonly GameEvent[]
  readonly cues: readonly string[]
  /** What the stage can reach on this device. */
  readonly outputs: StageOutputs
  /** The player's settings for the preview. They change only what the stage plays. */
  preview: Preview = $state({
    ...DEFAULT_SETTINGS,
    // Starts as the device is set, as it would for the player on it.
    reduced: typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  })
  /** Counts the times the stage should play again: after every change and on **Play again**. */
  replay: number = $state(0)
  /** True while a new feel is being written: the canvas still shows the old one, so adding to it now would land there. */
  adding: boolean = $state(false)

  constructor(toml: TomlSession<FeelContent>, extras: FeelExtras = {}) {
    super(toml, 0, 'Start a feel file')
    this.events = extras.events ?? []
    this.cues = extras.cues ?? []
    // A sound plays only when the game has it and the page can make sound; the device decides whether it can rumble.
    this.outputs = {
      rumble: (pulse) => extras.outputs?.rumble(pulse) ?? false,
      cue: (id) => {
        if (!this.cues.includes(id) || extras.play === undefined) return false
        extras.play(id)
        return true
      },
    }
  }

  override async change(label: string, edits: readonly ContentEdit[], coalesce?: string): Promise<Outcome> {
    const outcome = await super.change(label, edits, coalesce)
    if (outcome.ok) this.replay += 1
    return outcome
  }
}
