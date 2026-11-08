// One document whose file is written by patching its text (ED3D spec §4.5, §5.3 flow 9, §8; kit spec §5 flows 3 and
// 4): the kit's `DocumentSession` over a history, with a codec's `patch` as the way the file is printed. A level and
// the facility are both saved this way, each with its own history and session.
//
// What this adds to the kit's flow:
// - **The held Save (ED3-o).** Every save patches first. A refused patch writes nothing and does not reach the session
//   (no save problem, the status stays `dirty`); the refusal is the outcome and stays in `held` until a save goes
//   through, so the view can show the path and the reason and offer Save reformatted or Export a copy.
// - **The base follows the file.** `patch` needs the text and the model it parses to: those of the last text read or
//   written. After a save the model is the codec's parse of what was written, because the codec rounds numbers.
// - **The autosave holds the model**, as JSON, so Restore applies the model and the next save patches it into the file
//   as it is now, never an old text over a newer one.
import {
  createDocumentSession,
  type DocumentSession,
  discardRecovery,
  type History,
  type Recovery,
  type SaveOutcome,
  type StorageClock,
  type StorageFailure,
  type Workspace,
} from '@mcthaydt/automata-editor/kit/core'
import type { JsonPath, PatchRefusalReason, PatchResult } from '@mcthaydt/automata-editor/kit/documents'
import type { FileCodec, ParseIssue } from '../profile/file-codec'

export interface PatchRefused {
  readonly status: 'refused'
  /** The JSON path the codec cannot write. */
  readonly path: JsonPath
  readonly reason: PatchRefusalReason
  readonly detail: string
}

export type DocumentSaveOutcome = SaveOutcome | PatchRefused

export type ExportOutcome =
  | { readonly status: 'exported'; readonly name: string }
  | PatchRefused
  | { readonly status: 'failed'; readonly reason: StorageFailure; readonly message: string }

export type RestoreOutcome =
  | { readonly ok: true }
  | { readonly ok: false; readonly issues: readonly ParseIssue[] }

export interface PatchedDocument {
  readonly path: string
  readonly session: DocumentSession
  /** The refusal of the last save, until a save goes through: Save is held while it is set. */
  readonly held: PatchRefused | undefined
  save(): Promise<DocumentSaveOutcome>
  /** Keep mine: writes without checking that the file is still the one that was opened. */
  overwrite(): Promise<DocumentSaveOutcome>
  /** Save as copy: the first unused `name copy.ext`; the document keeps its own path and stays dirty. */
  saveCopy(): Promise<DocumentSaveOutcome>
  /** Writes the whole model as freshly formatted JSON, guarded like Save; it becomes the base. */
  saveReformatted(): Promise<DocumentSaveOutcome>
  /** Downloads the level under the file's name: the patched text, or the reformatted one when the patch refuses. */
  exportCopy(): Promise<ExportOutcome>
  /** Applies an autosave as one undoable step. Refused, changing nothing, when the payload no longer validates. */
  restore(recovery: Recovery): RestoreOutcome
  discardRecovery(): Promise<void>
  dispose(): void
}

export interface PatchedDocumentOptions<S, M> {
  readonly workspace: Workspace
  readonly clock: StorageClock
  readonly path: string
  /** The file's mtime as read before its bytes. */
  readonly mtime: number | undefined
  /** The text as read, and the model the codec parsed from it. */
  readonly text: string
  readonly model: M
  readonly codec: FileCodec<M>
  readonly history: History<S>
  /** The saved part of the history's state. */
  modelOf(state: S): M
  /** The state a restored model becomes. */
  withModel(model: M): S
}

/** The model as a person would write it from scratch: two-space JSON and a final newline. */
const reformat = (model: unknown): string => `${JSON.stringify(model, null, 2)}\n`

const refused = (result: Extract<PatchResult, { ok: false }>): PatchRefused => ({
  status: 'refused',
  path: result.path,
  reason: result.reason,
  detail: result.detail,
})

const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

export function createPatchedDocument<S, M>(options: PatchedDocumentOptions<S, M>): PatchedDocument {
  const { workspace, codec, history, modelOf, path } = options
  let base = { text: options.text, model: options.model }
  let held: PatchRefused | undefined
  /** How the next write prints the model: the patch, or the reformatted text that was already verified. */
  let pending: string | undefined

  const patched = (model: M): PatchResult => codec.patch(base.text, base.model, model)

  /** The reformatted text, if the codec reads it back; otherwise the refusal at the first issue. */
  const reformatted = (model: M): { ok: true; text: string } | { ok: false; refusal: PatchRefused } => {
    const text = reformat(model)
    const read = codec.parse(text)
    if (read.ok) return { ok: true, text }
    const issue = read.issues[0]
    return {
      ok: false,
      refusal: {
        status: 'refused',
        path: issue?.path ?? [],
        reason: 'verify-failed',
        detail: issue?.message ?? 'the reformatted text does not read back',
      },
    }
  }

  const session = createDocumentSession<S>({
    store: workspace.store,
    journal: workspace.journal,
    path,
    history,
    mtime: options.mtime,
    deviceOnly: !workspace.persistent,
    clock: options.clock,
    serializeFile(state) {
      if (pending !== undefined) return pending
      const result = patched(modelOf(state))
      // Checked before the write began; the state cannot have changed since, but a refusal must never be written.
      if (!result.ok) throw new Error(`${result.reason} at ${JSON.stringify(result.path)}: ${result.detail}`)
      return result.text
    },
    snapshot: (state) => JSON.stringify(modelOf(state)),
  })

  /**
   * Writes run one at a time, so `pending` is the text of the write that is running and the base a save leaves is the
   * text that save wrote. (The session also queues its saves; this queue keeps the base right whatever it does.)
   */
  let queue: Promise<unknown> = Promise.resolve()
  const queued = <T>(task: () => Promise<T>): Promise<T> => {
    const run = queue.then(task)
    queue = run.catch(() => undefined)
    return run
  }

  /** Runs one write with `text` as what the session prints; a saved file becomes the base when `becomesBase`. */
  async function write(
    text: string,
    run: () => Promise<SaveOutcome>,
    becomesBase: boolean,
  ): Promise<DocumentSaveOutcome> {
    pending = text
    let outcome: SaveOutcome
    try {
      outcome = await run()
    } finally {
      pending = undefined
    }
    if (outcome.status === 'saved') {
      held = undefined
      if (becomesBase) {
        const read = codec.parse(text)
        if (read.ok) base = { text, model: read.value }
      }
    }
    return outcome
  }

  /** Patches the model as it is when the write's turn comes; a refusal holds Save and writes nothing. */
  const patchedSave = (run: () => Promise<SaveOutcome>, becomesBase: boolean): Promise<DocumentSaveOutcome> =>
    queued(async () => {
      const result = patched(modelOf(history.state))
      if (!result.ok) {
        held = refused(result)
        return held
      }
      return write(result.text, run, becomesBase)
    })

  return {
    path,
    session,
    get held() {
      return held
    },
    save: () => patchedSave(() => session.save(), true),
    overwrite: () => patchedSave(() => session.overwrite(), true),
    saveCopy: () => patchedSave(() => session.saveCopy(), false),
    saveReformatted: () =>
      queued(async () => {
        const result = reformatted(modelOf(history.state))
        if (!result.ok) return result.refusal
        return write(result.text, () => session.save(), true)
      }),
    async exportCopy() {
      const model = modelOf(history.state)
      const patch = patched(model)
      let text: string
      if (patch.ok) text = patch.text
      else {
        const result = reformatted(model)
        if (!result.ok) return result.refusal
        text = result.text
      }
      const name = baseName(path)
      const written = await workspace.exports.write(name, text)
      if (written.ok) return { status: 'exported', name }
      return {
        status: 'failed',
        reason: written.reason === 'conflict' ? 'io' : written.reason,
        message: written.message,
      }
    },
    restore(recovery) {
      // Read the way a file is read, so a payload opens exactly when the same text would open as the file.
      const read = codec.parse(recovery.payload)
      if (!read.ok) return { ok: false, issues: read.issues }
      const model = read.value
      history.apply('Keep changes from last time', () => options.withModel(model))
      return { ok: true, baseChanged: recovery.baseChanged }
    },
    discardRecovery: () => discardRecovery(workspace.journal, path),
    dispose: () => session.dispose(),
  }
}
