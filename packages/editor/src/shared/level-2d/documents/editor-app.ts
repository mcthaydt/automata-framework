import { createHistory, type History } from '../../kit/history/history.ts'
import type { StorageClock } from '../../kit/storage/clock.ts'
import {
  createDocumentSession,
  type DocumentSession,
  type SaveOutcome,
} from '../../kit/storage/document-session.ts'
import {
  classifyStorageError,
  type StorageFailure,
  type WriteFailure,
} from '../../kit/storage/project-store.ts'
import { readStored } from '../../kit/storage/read-stored.ts'
import { findRecovery, type Recovery, discardRecovery as removeJournal } from '../../kit/storage/recovery.ts'
import type { Workspace } from '../../kit/storage/workspace.ts'
import type { IdSource } from '../model/ids'
import type { ParseError, Profile, ProfileRegistry, Result } from '../profiles/profile'
import { listProjects, type ProjectEntry } from './project-list'
import { readDocument } from './read-document'

// The editor's session over a workspace: creating a document from a
// template, opening a file with the profile that claims it, and keeping it saved. Plain TypeScript with no Svelte, so
// the views and the tests use the same object. Nothing here names a profile: the registry says which
// ones exist, and the first export of each is its working file.

/** One open document: the profile, its history and its save flow. The value type is the profile's; the view that knows it narrows it. */
export interface OpenDocument {
  readonly profile: Profile<unknown>
  readonly path: string
  readonly history: History<unknown>
  readonly session: DocumentSession
  save(): Promise<SaveOutcome>
  /** Keep mine: writes without checking that the file is still the one that was opened. */
  overwrite(): Promise<SaveOutcome>
  /** Save as copy: the first unused `name copy.ext`; the document keeps its own path. */
  saveCopy(): Promise<SaveOutcome>
  /** Applies an autosave as one undoable step, which leaves the document dirty. Refused, changing nothing, when the payload no longer parses. */
  /** The text the document was loaded or last saved as, which a profile's export targets patch. */
  base(): string
  restore(recovery: Recovery): Result<true, readonly ParseError[]>
  discardRecovery(): Promise<void>
  dispose(): void
}

export type OpenOutcome =
  | {
      readonly status: 'opened'
      readonly document: OpenDocument
      /** An autosave newer than the file, for the dialog to offer. */
      readonly recovery: Recovery | undefined
      /** Set when the autosave could not be read: the document opened anyway. */
      readonly recoveryError?: string | undefined
    }
  | {
      readonly status: 'choose'
      readonly path: string
      readonly candidates: readonly Profile<unknown>[]
      readonly text: string
    }
  | { readonly status: 'unrecognised'; readonly path: string; readonly text: string }
  | {
      readonly status: 'invalid'
      readonly path: string
      readonly profile: Profile<unknown>
      readonly errors: readonly ParseError[]
      readonly text: string
    }
  | { readonly status: 'notText' | 'missing'; readonly path: string }
  | { readonly status: 'tooLarge'; readonly path: string; readonly bytes: number }
  /** The store refused: a read that was denied, or a create that hit a full disk. */
  | {
      readonly status: 'storageFailed'
      readonly path: string
      readonly reason: StorageFailure
      readonly message: string
    }

export type CopyOutcome =
  | { readonly status: 'copied'; readonly path: string }
  | { readonly status: 'missing'; readonly path: string }
  | {
      readonly status: 'failed'
      readonly path: string
      readonly reason: StorageFailure
      readonly message: string
    }

export type ImportOutcome =
  | { readonly status: 'imported'; readonly name: string; readonly path: string }
  /** Nothing was written: no profile claims the file, it is not text, or it is over the size limit. */
  | {
      readonly status: 'refused'
      readonly name: string
      readonly reason: 'unrecognised' | 'notText' | 'tooLarge'
    }
  | {
      readonly status: 'failed'
      readonly name: string
      readonly reason: StorageFailure
      readonly message: string
    }

export interface EditorApp {
  readonly registry: ProfileRegistry
  readonly workspace: Workspace
  /** The projects Home shows, newest first. Rejects when the workspace cannot be listed. */
  list(): Promise<readonly ProjectEntry[]>
  /** Writes the template's working file (a taken path gets ` 2`, ` 3`) and opens it the way an existing file opens. */
  create(profileId: string, templateId: string): Promise<OpenOutcome>
  /** `as` is the id of the profile the person chose after a `choose`. */
  open(path: string, as?: string): Promise<OpenOutcome>
  /** Copies the file's bytes to the first unused `name copy.ext`, `name copy 2.ext`; a file that does not open copies too. */
  duplicate(path: string): Promise<CopyOutcome>
  /** Deletes the file and its autosave. A path with no file is not an error. */
  remove(path: string): Promise<void>
  /**
   * Keeps a file the person picked, under its own name (a taken name gets ` 2`, ` 3`). A file a profile claims is kept
   * as it is, even when it does not open, so the error panel can show why; any other file is refused.
   */
  importFile(name: string, bytes: Uint8Array): Promise<ImportOutcome>
}

export interface EditorAppOptions {
  readonly workspace: Workspace
  readonly registry: ProfileRegistry
  /** Where instance ids come from: templates place entities. */
  readonly ids: IdSource
  /** Time for the autosave debounce and for coalescing history steps. */
  readonly clock?: StorageClock
}

const systemClock: StorageClock = {
  now: () => Date.now(),
  setTimer: (ms, run) => setTimeout(run, ms),
  clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

/** A refused write as the storage failure the views know: `conflict` only comes with an `expected` mtime, which a plain write never passes. */
const failureOf = (written: {
  reason: WriteFailure
  message: string
}): { reason: StorageFailure; message: string } => ({
  reason: written.reason === 'conflict' ? 'io' : written.reason,
  message: written.message,
})

const baseName = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

/** The stem and the extension of `path`; the extension starts at the first dot of the file name, so `a.af2d.json` keeps both parts, and a name that starts with a dot has none. */
function splitName(path: string): { stem: string; extension: string } {
  const name = path.lastIndexOf('/') + 1
  const dot = path.indexOf('.', name + 1)
  return dot === -1 ? { stem: path, extension: '' } : { stem: path.slice(0, dot), extension: path.slice(dot) }
}

export function createEditorApp(options: EditorAppOptions): EditorApp {
  const { workspace, registry, ids } = options
  const clock = options.clock ?? systemClock

  /** Opens a stored file. `readStored` stats first, so a file that changes after it can only make the next save a conflict, never overwrite silently. */
  async function open(path: string, as?: string): Promise<OpenOutcome> {
    const stored = await readStored(workspace.store, path)
    if (stored.status !== 'read') return { ...stored, path }
    const { mtime, bytes } = stored
    const read = readDocument(registry, baseName(path), bytes, as)
    if (read.status !== 'parsed') return { ...read, path }
    let recovery: Recovery | undefined
    let recoveryError: string | undefined
    try {
      recovery = await findRecovery(workspace.store, workspace.journal, path)
    } catch (error) {
      recoveryError = classifyStorageError(error).message
    }
    const document = openDocument(path, mtime, read.profile, read.value, read.text)
    return recoveryError === undefined
      ? { status: 'opened', document, recovery }
      : { status: 'opened', document, recovery, recoveryError }
  }

  function openDocument(
    path: string,
    mtime: number,
    profile: Profile<unknown>,
    value: unknown,
    loaded: string,
  ): OpenDocument {
    // The text a codec may patch: as last read or written (decision 5).
    let base = loaded
    let printed: string | undefined
    const history = createHistory<unknown>(value, { now: clock.now })
    const session = createDocumentSession<unknown>({
      store: workspace.store,
      journal: workspace.journal,
      path,
      history,
      mtime,
      deviceOnly: !workspace.persistent,
      clock,
      serializeFile: (state) => {
        printed = profile.print(base, state)
        return printed
      },
      snapshot: (state) => profile.print(base, state),
    })

    // Saves run one at a time, so `printed` (set while the save serialises, which a saved outcome always did) is the text of the save that just finished.
    let queue: Promise<unknown> = Promise.resolve()
    const writing = (write: () => Promise<SaveOutcome>, becomesBase: boolean): Promise<SaveOutcome> => {
      const run = queue.then(async () => {
        const outcome = await write()
        if (becomesBase && outcome.status === 'saved' && printed !== undefined) base = printed
        return outcome
      })
      queue = run.catch(() => undefined)
      return run
    }

    return {
      profile,
      path,
      history,
      session,
      save: () => writing(() => session.save(), true),
      overwrite: () => writing(() => session.overwrite(), true),
      saveCopy: () => writing(() => session.saveCopy(), false),
      base: () => base,
      restore(recovery) {
        const parsed = profile.parse(recovery.payload)
        if (!parsed.ok) return parsed
        history.apply('Restore autosave', () => parsed.value)
        base = recovery.payload
        return { ok: true, value: true }
      },
      discardRecovery: () => removeJournal(workspace.journal, path),
      dispose: () => session.dispose(),
    }
  }

  /** `path` itself, or the first of `name 2.ext`, `name 3.ext` that the workspace does not have. */
  async function firstFree(path: string): Promise<string> {
    const { stem, extension } = splitName(path)
    const taken = new Set((await workspace.store.list(stem)).map((entry) => entry.path))
    let free = path
    for (let n = 2; taken.has(free); n += 1) free = `${stem} ${n}${extension}`
    return free
  }

  async function create(profileId: string, templateId: string): Promise<OpenOutcome> {
    const profile = registry.get(profileId)
    if (profile === undefined) throw new RangeError(`no profile "${profileId}"`)
    const template = profile.templates.find((candidate) => candidate.id === templateId)
    if (template === undefined) throw new RangeError(`no template "${templateId}" in profile "${profileId}"`)
    const working = profile.exports[0]
    // A new document has no loaded text, so its `base` is empty (`files` keeps what it does not model from `base`).
    const file = working?.files(template.create(ids), '')[0]
    if (file === undefined) throw new RangeError(`profile "${profileId}" has no working file export`)
    try {
      const path = await firstFree(file.path)
      const written = await workspace.store.write(path, file.contents)
      if (!written.ok) return { status: 'storageFailed', path, ...failureOf(written) }
      return open(path)
    } catch (error) {
      return { status: 'storageFailed', path: file.path, ...classifyStorageError(error) }
    }
  }

  async function duplicate(path: string): Promise<CopyOutcome> {
    try {
      const bytes = await workspace.store.read(path)
      if (bytes === undefined) return { status: 'missing', path }
      const { stem, extension } = splitName(path)
      const taken = new Set((await workspace.store.list(`${stem} copy`)).map((entry) => entry.path))
      let copy = `${stem} copy${extension}`
      for (let n = 2; taken.has(copy); n += 1) copy = `${stem} copy ${n}${extension}`
      const written = await workspace.store.write(copy, bytes)
      return written.ok ? { status: 'copied', path: copy } : { status: 'failed', path, ...failureOf(written) }
    } catch (error) {
      return { status: 'failed', path, ...classifyStorageError(error) }
    }
  }

  async function importFile(pickedName: string, bytes: Uint8Array): Promise<ImportOutcome> {
    const name = baseName(pickedName)
    const read = readDocument(registry, name, bytes)
    if (read.status === 'unrecognised' || read.status === 'notText' || read.status === 'tooLarge')
      return { status: 'refused', name, reason: read.status }
    try {
      const path = await firstFree(name)
      const written = await workspace.store.write(path, bytes)
      return written.ok
        ? { status: 'imported', name, path }
        : { status: 'failed', name, ...failureOf(written) }
    } catch (error) {
      return { status: 'failed', name, ...classifyStorageError(error) }
    }
  }

  async function remove(path: string): Promise<void> {
    await workspace.store.remove(path)
    await removeJournal(workspace.journal, path)
  }

  return {
    registry,
    workspace,
    list: () => listProjects(workspace, registry),
    create,
    open,
    duplicate,
    remove,
    importFile,
  }
}
