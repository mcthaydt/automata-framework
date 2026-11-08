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
  readonly outputs?: StageOutputs
}

export class FeelSession extends ContentSession<FeelContent, number | 'limits'> {
  /** What the game can answer, best first; read when the editor opened. */
  readonly events: readonly GameEvent[]
  readonly cues: readonly string[]
  /** What the stage can reach on this device. */
  readonly outputs: StageOutputs
  /** The player's settings for the preview. They change only what the stage plays. */
  preview: Preview = $state({ ...DEFAULT_SETTINGS, reduced: false })
  /** Counts the times the stage should play again: after every change and on **Play again**. */
  replay: number = $state(0)

  constructor(toml: TomlSession<FeelContent>, extras: FeelExtras = {}) {
    super(toml, 0, 'Start a feel file')
    this.events = extras.events ?? []
    this.cues = extras.cues ?? []
    this.outputs = extras.outputs ?? { rumble: () => false, cue: (id) => this.cues.includes(id) }
  }

  override async change(label: string, edits: readonly ContentEdit[], coalesce?: string): Promise<Outcome> {
    const outcome = await super.change(label, edits, coalesce)
    if (outcome.ok) this.replay += 1
    return outcome
  }
}
