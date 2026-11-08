// Feel's session: the game's feel file, which feel is chosen, and the last refusal in words. It outlives the view, so
// switching to another editor and back finds the same feel chosen. The file's own history is the TOML session's;
// `revision` only tells Svelte that history moved.

import type { ContentEdit } from '@automata/editor/kit/documents'
import type { FeelContent } from '@automata/feel'
import type { Outcome, TomlRead, TomlSession } from '../../shared/toml-session.ts'

/** The file's content as far as it can be read: what passes the schema, or the parsed value when only a check fails. */
export function contentOf(read: TomlRead<FeelContent>): FeelContent | undefined {
  if (read.kind === 'ok') return read.value
  if (read.kind === 'invalid' && typeof read.value === 'object' && read.value !== null)
    return read.value as FeelContent
  return undefined
}

export class FeelSession {
  #revision = $state(0)
  /** The chosen feel's index, or `'limits'` for the "Never more than" page. */
  chosen: number | 'limits' = $state(0)
  /** Why the last change was not made, until the next one is. */
  message: string | undefined = $state()
  readonly toml: TomlSession<FeelContent>

  constructor(toml: TomlSession<FeelContent>) {
    this.toml = toml
    toml.history.subscribe(() => {
      this.#revision += 1
    })
  }

  get read(): TomlRead<FeelContent> {
    void this.#revision
    return this.toml.read()
  }

  get content(): FeelContent | undefined {
    return contentOf(this.read)
  }

  async change(label: string, edits: readonly ContentEdit[], coalesce?: string): Promise<Outcome> {
    const outcome = await this.toml.edit(label, edits, coalesce === undefined ? undefined : { coalesce })
    this.message = outcome.ok ? undefined : outcome.message
    return outcome
  }

  async start(): Promise<Outcome> {
    const outcome = await this.toml.create('Start a feel file')
    this.message = outcome.ok ? undefined : outcome.message
    return outcome
  }
}
