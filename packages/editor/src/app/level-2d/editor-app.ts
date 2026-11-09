// The editor's app logic without a view: listing, creating from a template, opening a file with the profile that claims
// it, copying, importing and removing documents, and keeping an open one saved. Each answers with an outcome the views
// turn into screens. Plain TypeScript with no Svelte, so the views and the tests use the same object. Nothing here names
// a profile: the registry says which ones exist, and the first export of each is its working file.
import { loadEditorList } from '../../shared/editor-list/editor-list'
import { EDITOR_LIST_PATH } from '../../shared/editor-list/editors.schema'
import { fileAccess, newFilePath } from '../../shared/editor-list/workspace-policy'
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
import { createGameSave, type GameSave } from './save-to-game'
import { splitName, uniqueName } from './unique-name'

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

export function createEditorApp(options: EditorAppOptions): EditorApp {
  const { workspace, registry, ids } = options
  const clock = options.clock ?? systemClock

  /**
   * On a served game checkout, the game save of a document whose editor-list row names an `exports` folder and whose
   * profile says which of its exports a game reads. Anything else (browser storage, no list, a list that does not
   * load, a document no row exports) saves the document alone.
   */
  async function gameSaveFor(
    path: string,
    profile: Profile<unknown>,
    value: unknown,
    loaded: string,
  ): Promise<GameSave | undefined> {
    const target = profile.exports.find((candidate) => candidate.id === profile.gameTarget)
    if (workspace.served !== true || target === undefined) return undefined
    let listText: string | undefined
    try {
      const bytes = await workspace.store.read(EDITOR_LIST_PATH)
      listText = bytes === undefined ? undefined : new TextDecoder().decode(bytes)
    } catch {
      return undefined
    }
    const loadedList = loadEditorList(listText)
    if (!loadedList.ok) return undefined
    const access = fileAccess(loadedList.list, path)
    const folder = access.row?.exports
    if (!access.writable || folder === undefined) return undefined
    return createGameSave(workspace.store, target, folder, { value, base: loaded })
  }

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
    const game = await gameSaveFor(path, read.profile, read.value, read.text)
    const document = openDocument(path, mtime, read.profile, read.value, read.text, game)
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
    game: GameSave | undefined,
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
      ...(game === undefined ? {} : { beforeSave: (mode) => game.write(history.state, () => base, mode) }),
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
      gameFolder: game?.folder,
      save: () => writing(() => session.save(), true),
      overwrite: () => writing(() => session.overwrite(), true),
      saveCopy: () => writing(() => session.saveCopy(), false),
      base: () => base,
      restore(recovery) {
        const parsed = profile.parse(recovery.payload)
        if (!parsed.ok) return parsed
        history.apply('Keep changes from last time', () => parsed.value)
        base = recovery.payload
        return { ok: true, value: true }
      },
      discardRecovery: () => removeJournal(workspace.journal, path),
      dispose: () => session.dispose(),
    }
  }

  /** `path` itself, or the first of `name 2.ext`, `name 3.ext` that the workspace does not have. */
  async function firstFree(path: string): Promise<string> {
    const taken = await workspace.store.list(splitName(path).stem)
    return uniqueName(path, new Set(taken.map((entry) => entry.path)))
  }

  /**
   * Where a new file goes: on a served checkout, the folder its editor list lets the editor write a file of that name
   * (a game keeps its levels in `content/rooms/`, not at its root, and the server refuses anything else); in browser
   * storage, or a checkout without a list that loads, the name itself, as before.
   */
  async function placeNew(
    name: string,
  ): Promise<{ status: 'placed'; path: string } | { status: 'refused'; message: string }> {
    if (workspace.served !== true) return { status: 'placed', path: name }
    const bytes = await workspace.store.read(EDITOR_LIST_PATH)
    const loaded = loadEditorList(bytes === undefined ? undefined : new TextDecoder().decode(bytes))
    if (!loaded.ok) return { status: 'placed', path: name }
    const path = newFilePath(loaded.list, name)
    return path === undefined
      ? {
          status: 'refused',
          message: `Your game has no folder for new levels yet. Add one to ${EDITOR_LIST_PATH}, then try again.`,
        }
      : { status: 'placed', path }
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
      const placed = await placeNew(file.path)
      if (placed.status === 'refused')
        return { status: 'storageFailed', path: '', reason: 'io', message: placed.message }
      const path = await firstFree(placed.path)
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
      const taken = await workspace.store.list(`${splitName(path).stem} copy`)
      const copy = uniqueName(path, new Set(taken.map((entry) => entry.path)), ' copy')
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
