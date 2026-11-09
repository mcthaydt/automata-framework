// An editor's session over one TOML file: the file (its history is the TOML session's), what the person has chosen, and
// the last refusal in words. It outlives the view, so switching to another editor and back finds the same thing chosen.
// `revision` only tells Svelte that the history moved.
import type { ContentEdit } from '@automata/editor/kit/documents'
import type { Outcome, Problem, TomlRead, TomlSession } from './toml-session.ts'

/** The file's content as far as it can be read: what passes the schema, or the parsed value when only a check fails. */
export function contentOf<T>(read: TomlRead<T>): T | undefined {
  if (read.kind === 'ok') return read.value
  if (read.kind === 'invalid' && typeof read.value === 'object' && read.value !== null) return read.value as T
  return undefined
}

export class ContentSession<T, Chosen> {
  #revision = $state(0)
  /** What the panel has chosen; the canvas shows it. */
  chosen: Chosen = $state() as Chosen
  /** Why the last change was not made, until the next one is. */
  message: string | undefined = $state()
  readonly toml: TomlSession<T>
  readonly #startLabel: string

  constructor(toml: TomlSession<T>, chosen: Chosen, startLabel: string) {
    this.toml = toml
    this.chosen = chosen
    this.#startLabel = startLabel
    toml.history.subscribe(() => {
      this.#revision += 1
    })
  }

  get read(): TomlRead<T> {
    void this.#revision
    return this.toml.read()
  }

  get content(): T | undefined {
    return contentOf(this.read)
  }

  /** The problems of the file's schema, or none. */
  get problems(): readonly Problem[] {
    const read = this.read
    return read.kind === 'invalid' ? read.problems : []
  }

  async change(label: string, edits: readonly ContentEdit[], coalesce?: string): Promise<Outcome> {
    const outcome = await this.toml.edit(label, edits, coalesce === undefined ? undefined : { coalesce })
    this.message = outcome.ok ? undefined : outcome.message
    return outcome
  }

  async start(): Promise<Outcome> {
    const outcome = await this.toml.create(this.#startLabel)
    this.message = outcome.ok ? undefined : outcome.message
    return outcome
  }
}

/** The problem whose key path is exactly `path`, or `undefined`. */
export function problemAt<P extends { readonly keyPath: readonly (string | number)[] }>(
  problems: readonly P[],
  path: readonly (string | number)[],
): P | undefined {
  return problems.find(
    (problem) =>
      problem.keyPath.length === path.length && problem.keyPath.every((key, at) => key === path[at]),
  )
}
