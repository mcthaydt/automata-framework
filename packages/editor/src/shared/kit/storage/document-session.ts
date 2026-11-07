// One open document's saving: the Save button, the autosave beside it, and the single list of problems a failed save
// or a stopped autosave leaves for the view to show.
import type { History } from '../history/history'
import { type AutosaveProblem, createAutosave } from './autosave'
import { type StorageClock, systemClock } from './clock'
import { contentHash } from './content-hash'
import {
  classifyStorageError,
  type ProjectStore,
  type StorageFailure,
  statPath,
  toBytes,
} from './project-store'
import type { SaveState } from './save-state'

/** Something that went wrong with keeping the document: a failed save, or an autosave that stopped. */
export interface Problem {
  readonly source: 'save' | 'autosave'
  readonly reason: StorageFailure
  readonly message: string
  /** True when autosave has stopped (out of quota) until a save works. */
  readonly paused: boolean
}

export type SaveOutcome =
  | { readonly status: 'saved'; readonly path: string }
  /** The file changed (or went away) since it was opened. Nothing was written. */
  | { readonly status: 'conflict' }
  | { readonly status: 'failed'; readonly reason: StorageFailure; readonly message: string }

/** Why files written before the document stopped its save. */
export type BeforeSaveStop = Extract<SaveOutcome, { status: 'conflict' | 'failed' }>

export interface DocumentSessionOptions<S> {
  readonly store: ProjectStore
  readonly journal: ProjectStore
  readonly path: string
  readonly history: History<S>
  /** The bytes or text of the document's file. Throwing makes the save fail, writing nothing. */
  serializeFile(state: S): Uint8Array | string
  /** The editor's own string for the document's model, kept by the autosave journal. */
  snapshot(state: S): string
  /**
   * Files that must be written before the document's own, such as a game's files (`mode` is `overwrite` for Keep
   * mine). Answers `undefined` when they are written; a conflict or failure stops the save before the document is
   * touched.
   */
  beforeSave?(mode: 'guarded' | 'overwrite'): Promise<BeforeSaveStop | undefined>
  /** The file's `mtime` when it was opened; `undefined` for a document with no file yet. */
  readonly mtime?: number | undefined
  /** `Workspace.persistent === false`: nothing is kept on this device, so the status stays `device`. */
  readonly deviceOnly?: boolean
  readonly clock?: StorageClock
  /** Default 800 ms. */
  readonly debounceMs?: number
  /** Called when a problem appears, so the shell can toast it. */
  onproblem?(problem: Problem): void
}

export interface DocumentSession {
  readonly status: SaveState
  /** The save or autosave problem that is current, if any. */
  readonly problem: Problem | undefined
  /** Called when `status` or `problem` changes; returns a way to stop. */
  subscribe(run: () => void): () => void
  /** Writes the document if the file is still the version it was opened or last saved as. */
  save(): Promise<SaveOutcome>
  /** Keep mine: writes without the check, replacing whatever is there. */
  overwrite(): Promise<SaveOutcome>
  /** Save as copy: the first unused "name copy.ext" (then "name copy 2.ext"). The session keeps its own file. */
  saveCopy(): Promise<SaveOutcome>
  /** Writes the autosave journal now (the page is going away). */
  flush(): Promise<void>
  /** Removes the autosave journal, e.g. after Discard, or after Take theirs reloaded the file. */
  discardJournal(): Promise<void>
  dispose(): void
}

/** `stages/a.toml` is `stages/a` and `.toml`; a name with no extension, or a dotfile like `.hidden`, has none. */
function splitExtension(path: string): { stem: string; extension: string } {
  const dot = path.lastIndexOf('.')
  return dot > path.lastIndexOf('/') + 1
    ? { stem: path.slice(0, dot), extension: path.slice(dot) }
    : { stem: path, extension: '' }
}

/**
 * The save flow of the editor kit for one open document: it owns the file's last known
 * `mtime`, the autosave journal and the save state the status line shows. The editor calls `save` and reacts to
 * the outcome (a conflict opens the Keep mine / Take theirs / Save as copy dialog; a failure toasts), and tells the
 * session nothing else: edits reach it through the history.
 */
export function createDocumentSession<S>(options: DocumentSessionOptions<S>): DocumentSession {
  const { store, history, path } = options
  let knownMtime = options.mtime
  let saves = 0
  let saveProblem: Problem | undefined
  let autosaveProblem: Problem | undefined
  let chain: Promise<unknown> = Promise.resolve()
  const listeners = new Set<() => void>()

  const dirty = (): boolean => history.revision !== history.cleanRevision

  const currentStatus = (): SaveState => {
    if (saves > 0) return 'saving'
    if (saveProblem !== undefined || autosaveProblem !== undefined) return 'error'
    if (options.deviceOnly === true) return 'device'
    return dirty() ? 'dirty' : 'saved'
  }
  const currentProblem = (): Problem | undefined => saveProblem ?? autosaveProblem

  let announced = { status: currentStatus(), problem: currentProblem() }
  const notify = (): void => {
    const next = { status: currentStatus(), problem: currentProblem() }
    if (next.status === announced.status && next.problem === announced.problem) return
    announced = next
    for (const run of [...listeners]) run()
  }

  const raise = (problem: Problem): void => {
    if (problem.source === 'save') saveProblem = problem
    else autosaveProblem = problem
    options.onproblem?.(problem)
  }

  const autosave = createAutosave({
    history,
    journal: options.journal,
    path,
    snapshot: options.snapshot,
    clock: options.clock ?? systemClock,
    debounceMs: options.debounceMs ?? 800,
    baseMtime: knownMtime,
    onproblem(problem: AutosaveProblem | undefined) {
      if (problem === undefined) {
        autosaveProblem = undefined
        notify()
      } else {
        raise({ source: 'autosave', ...problem })
        notify()
      }
    },
  })

  const unsubscribe = history.subscribe(notify)

  /** Runs saves one at a time, so a second one sees the `mtime` the first one got. */
  const sequentially = <T>(task: () => Promise<T>): Promise<T> => {
    const result = chain.then(task)
    chain = result.catch(() => undefined)
    return result
  }

  const failed = (reason: StorageFailure, message: string): SaveOutcome => {
    raise({ source: 'save', reason, message, paused: false })
    return { status: 'failed', reason, message }
  }

  /** Serializes the document and writes it to `target`; `guard` is the `mtime` the file must still have. */
  async function writeDocument(
    target: string,
    guard: { mtime: number } | 'new' | undefined,
  ): Promise<{ outcome: SaveOutcome; mtime?: number; hash?: string }> {
    let data: Uint8Array | string
    try {
      data = options.serializeFile(history.state)
    } catch (error) {
      return { outcome: failed('io', classifyStorageError(error).message) }
    }
    try {
      if (guard === 'new' && (await statPath(store, target)) !== undefined)
        return { outcome: { status: 'conflict' } }
      const result = await store.write(target, data, guard === 'new' ? undefined : guard)
      if (result.ok) {
        const hash = await contentHash(toBytes(data))
        return { outcome: { status: 'saved', path: target }, mtime: result.mtime, hash }
      }
      if (result.reason === 'conflict') return { outcome: { status: 'conflict' } }
      return { outcome: failed(result.reason, result.message) }
    } catch (error) {
      const { reason, message } = classifyStorageError(error)
      return { outcome: failed(reason, message) }
    }
  }

  /** Runs `task` as a save: one at a time, with the status line showing `saving` meanwhile. */
  const tracked = <T>(task: () => Promise<T>): Promise<T> =>
    sequentially(async () => {
      saves += 1
      notify()
      try {
        return await task()
      } finally {
        saves -= 1
        notify()
      }
    })

  /** A save of the session's own file; Keep mine passes `guarded: false`. */
  const saveOwnFile = (guarded: boolean): Promise<SaveOutcome> =>
    tracked(async () => {
      const revision = history.revision
      // The files written ahead of the document must not land when the document itself would then be refused: that
      // leaves them made from edits the document on disk does not have. So a guarded save checks the document first.
      if (guarded && options.beforeSave !== undefined && knownMtime !== undefined) {
        try {
          if ((await statPath(store, path))?.mtime !== knownMtime) return { status: 'conflict' }
        } catch (error) {
          const { reason, message } = classifyStorageError(error)
          return failed(reason, message)
        }
      }
      const stop = await options.beforeSave?.(guarded ? 'guarded' : 'overwrite')
      if (stop?.status === 'failed') return failed(stop.reason, stop.message)
      if (stop !== undefined) return stop
      const guard = !guarded ? undefined : knownMtime === undefined ? 'new' : { mtime: knownMtime }
      const { outcome, mtime, hash } = await writeDocument(path, guard)
      if (outcome.status === 'saved' && mtime !== undefined) {
        knownMtime = mtime
        autosave.setBase(mtime, hash)
        saveProblem = undefined
        autosaveProblem = undefined
        autosave.resume()
        // Only what was saved is clean: an edit made while the write was in flight is still unsaved.
        if (history.revision === revision) {
          history.markClean()
          await autosave.clear()
        }
      }
      return outcome
    })

  const saveCopy = (): Promise<SaveOutcome> =>
    tracked(async () => {
      const { stem, extension } = splitExtension(path)
      const named = (n: number): string => `${stem} copy${n === 1 ? '' : ` ${n}`}${extension}`
      try {
        const taken = new Set((await store.list(`${stem} copy`)).map((entry) => entry.path))
        let n = 1
        while (taken.has(named(n))) n += 1
        return (await writeDocument(named(n), undefined)).outcome
      } catch (error) {
        const { reason, message } = classifyStorageError(error)
        return failed(reason, message)
      }
    })

  return {
    get status() {
      return currentStatus()
    },
    get problem() {
      return currentProblem()
    },
    subscribe(run) {
      listeners.add(run)
      return () => {
        listeners.delete(run)
      }
    },
    save: () => saveOwnFile(true),
    overwrite: () => saveOwnFile(false),
    saveCopy,
    flush: () => autosave.flush(),
    discardJournal: () => autosave.clear(),
    dispose() {
      autosave.dispose()
      unsubscribe()
      listeners.clear()
    },
  }
}
