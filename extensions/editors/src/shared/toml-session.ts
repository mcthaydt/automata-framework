// One TOML file of the game, open in an editor: its text in the kit's history, read through the extension's own
// schema after every change. An edit goes through the kit's content documents, so it rewrites only the literals it
// changes and the file's comments stay where the person put them. A step is applied first, so the shell's record of
// the write carries the editor's label, and a write the workspace refuses takes the step back: what the person sees
// is always what the file holds.
import { createHistory, type History } from '@automata/editor/kit/core'
import { type ContentEdit, DocumentSyntaxError, openDocument } from '@automata/editor/kit/documents'
import type { SuitePorts } from '@automata/editor/kit/ports'
import type { z } from 'zod'
import { problemWords } from './problem-words.ts'

export interface TomlState {
  /** The file's text, or `undefined` while the game has no such file. */
  readonly text: string | undefined
}

/** A schema problem: where it is, by key path, and what to do about it, in words. */
export interface Problem {
  readonly keyPath: readonly (string | number)[]
  readonly message: string
}

export type TomlRead<T> =
  | { readonly kind: 'missing' }
  | {
      readonly kind: 'syntax'
      readonly line?: number | undefined
      readonly column?: number | undefined
      readonly message: string
    }
  | { readonly kind: 'ok'; readonly value: T; readonly problems: readonly Problem[] }
  | { readonly kind: 'invalid'; readonly value: unknown; readonly problems: readonly Problem[] }

export type Outcome = { readonly ok: true } | { readonly ok: false; readonly message: string }

export interface TomlSession<T> {
  readonly path: string
  readonly history: History<TomlState>
  /** The file as it is now, parsed once per state. */
  read(): TomlRead<T>
  exists(): boolean
  /** Makes the file from the editor's empty text, as one undo step. */
  create(label: string): Promise<Outcome>
  /** The edits, applied in order, as one undo step labelled `label`. */
  edit(
    label: string,
    edits: readonly ContentEdit[],
    options?: { readonly coalesce?: string },
  ): Promise<Outcome>
  /** A whole new text (an accepted Ask proposal) as one undo step. */
  accept(text: string, summary: string): Promise<Outcome>
  /** The text the edits would make, without making them: for a step that writes more than one file. */
  preview(
    edits: readonly ContentEdit[],
  ): { readonly ok: true; readonly text: string } | { readonly ok: false; readonly message: string }
  /** The file's mtime as this session last saw it, for a write of several files to expect. */
  mtime(): number | undefined
  /**
   * A text the suite already wrote together with other files, taken as one history step (no write of its own), and the
   * new mtime read so the next edit is not refused as a conflict.
   */
  adopt(label: string, text: string): Promise<void>
  undo(): Promise<Outcome>
  redo(): Promise<Outcome>
  /**
   * Moves the history one step without writing, after the suite's write path has already written that step back
   * (its Undo and Redo), and reads the file's new mtime so the next edit is not refused as a conflict.
   */
  follow(back: boolean): Promise<void>
}

export interface TomlSessionOptions<T> {
  readonly path: string
  readonly ports: SuitePorts
  readonly schema: z.ZodType<T>
  /** The text `create` writes: a comment that says what the file is for. */
  readonly empty: string
  /**
   * Called with the step's label as each edit, accept or create is about to be written (not for Undo or Redo), so the
   * suite's record of the write can carry it. What it gives back is called if the write is refused.
   */
  readonly onStep?: ((label: string) => (() => void) | undefined) | undefined
}

const OK: Outcome = { ok: true }
const refused = (message: string): Outcome => ({ ok: false, message })

/** The file's text parsed and checked, never thrown. */
export function readToml<T>(path: string, text: string | undefined, schema: z.ZodType<T>): TomlRead<T> {
  if (text === undefined) return { kind: 'missing' }
  let value: unknown
  try {
    value = openDocument(path, text).value()
  } catch (error) {
    if (error instanceof DocumentSyntaxError)
      return { kind: 'syntax', line: error.line, column: error.column, message: error.message }
    return { kind: 'syntax', message: error instanceof Error ? error.message : String(error) }
  }
  const checked = schema.safeParse(value)
  if (checked.success) return { kind: 'ok', value: checked.data, problems: [] }
  const problems = checked.error.issues.map((issue) => ({
    keyPath: issue.path.filter((key): key is string | number => typeof key !== 'symbol'),
    message: problemWords(issue),
  }))
  return { kind: 'invalid', value, problems }
}

export async function openTomlSession<T>(options: TomlSessionOptions<T>): Promise<TomlSession<T>> {
  const { path, ports, schema } = options
  const { workspace } = ports
  const opened = await workspace.read(path)
  let mtime: number | undefined = opened?.mtime
  const history = createHistory<TomlState>({ text: opened?.text })

  let cached: { readonly text: string | undefined; readonly read: TomlRead<T> } | undefined
  const read = (): TomlRead<T> => {
    const text = history.state.text
    if (cached === undefined || cached.text !== text) cached = { text, read: readToml(path, text, schema) }
    return cached.read
  }

  /** Writes `to` when it differs from `from`; a file that goes back to not existing is removed. */
  async function sync(from: TomlState, to: TomlState): Promise<Outcome> {
    if (from.text === to.text) return OK
    if (to.text === undefined) {
      if (mtime === undefined) return OK
      const removed = await workspace.remove(path, { mtime })
      if (!removed.ok) return refused(removed.message)
      mtime = undefined
      return OK
    }
    const written = await workspace.write(
      path,
      to.text,
      from.text === undefined || mtime === undefined ? 'absent' : { mtime },
    )
    if (!written.ok) return refused(written.message)
    mtime = written.mtime
    return OK
  }

  async function commit(label: string, next: TomlState, coalesce?: string): Promise<Outcome> {
    const from = history.state
    history.apply(label, () => next, coalesce === undefined ? undefined : { coalesce })
    const retract = options.onStep?.(label)
    const written = await sync(from, next)
    if (!written.ok) {
      history.undo()
      retract?.()
    }
    return written
  }

  /** The edits applied to the text, or why not. */
  function attempt(
    edits: readonly ContentEdit[],
  ): { readonly ok: true; readonly text: string } | { readonly ok: false; readonly message: string } {
    const text = history.state.text
    if (text === undefined) return { ok: false, message: 'There is no file to change yet.' }
    let result: ReturnType<ReturnType<typeof openDocument>['edit']>
    try {
      result = openDocument(path, text).edit(edits)
    } catch (error) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) }
    }
    if (!result.ok) return { ok: false, message: `That change could not be made: ${result.message}` }
    return { ok: true, text: result.document.text }
  }

  async function travel(back: boolean): Promise<Outcome> {
    const before = history.state
    if (back) history.undo()
    else history.redo()
    const written = await sync(before, history.state)
    if (written.ok) return OK
    if (back) history.redo()
    else history.undo()
    return written
  }

  return {
    path,
    history,
    read,
    exists: () => history.state.text !== undefined,
    async create(label) {
      if (history.state.text !== undefined) return OK
      return commit(label, { text: options.empty })
    },
    async edit(label, edits, editOptions) {
      const next = attempt(edits)
      return next.ok ? commit(label, { text: next.text }, editOptions?.coalesce) : refused(next.message)
    },
    accept: (text, summary) => commit(summary, { text }),
    preview: attempt,
    mtime: () => mtime,
    async adopt(label, text) {
      history.apply(label, () => ({ text }))
      mtime = (await workspace.read(path))?.mtime
    },
    undo: () => travel(true),
    redo: () => travel(false),
    async follow(back) {
      if (back) history.undo()
      else history.redo()
      mtime = (await workspace.read(path))?.mtime
    },
  }
}
