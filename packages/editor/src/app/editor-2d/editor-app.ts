// The editor's app logic without a view: listing, creating, opening, copying, importing and removing documents, each
// answering with an outcome the views turn into screens.
import { createHistory, type History } from '../../shared/kit/history/history.ts'
import { type StorageClock, systemClock } from '../../shared/kit/storage/clock.ts'
import {
  createDocumentSession,
  type DocumentSession,
  type SaveOutcome,
} from '../../shared/kit/storage/document-session.ts'
import {
  classifyStorageError,
  type StorageFailure,
  type WriteFailure,
} from '../../shared/kit/storage/project-store.ts'
import { readStored } from '../../shared/kit/storage/read-stored.ts'
import {
  findRecovery,
  type Recovery,
  discardRecovery as removeJournal,
} from '../../shared/kit/storage/recovery.ts'
import { baseName } from '../../shared/kit/storage/store-path.ts'
import type { Workspace } from '../../shared/kit/storage/workspace.ts'
import type { IdSource } from '../../shared/level-2d/model/ids'
import type { ParseError, Profile, ProfileRegistry, Result } from '../../shared/level-2d/profiles/profile'
import { readDocument } from '../../shared/level-2d/profiles/read-document'
import type {
  CopyOutcome,
  EditorApp,
  ImportOutcome,
  OpenDocument,
  OpenOutcome,
} from '../../shared/level-2d/session/editor-app-types'
import { listProjects } from './project-list'

// The editor's session over a workspace: creating a document from a
// template, opening a file with the profile that claims it, and keeping it saved. Plain TypeScript with no Svelte, so
// the views and the tests use the same object. Nothing here names a profile: the registry says which
// ones exist, and the first export of each is its working file.

export interface EditorAppOptions {
  readonly workspace: Workspace
  readonly registry: ProfileRegistry
  /** Where instance ids come from: templates place entities. */
  readonly ids: IdSource
  /** Time for the autosave debounce and for coalescing history steps. */
  readonly clock?: StorageClock
}

/** A refused write as the storage failure the views know: `conflict` only comes with an `expected` mtime, which a plain write never passes. */
const failureOf = (written: {
  reason: WriteFailure
  message: string
}): { reason: StorageFailure; message: string } => ({
  reason: written.reason === 'conflict' ? 'io' : written.reason,
  message: written.message,
})

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
