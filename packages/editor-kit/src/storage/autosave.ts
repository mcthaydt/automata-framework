import type { History } from '../history/history'
import type { StorageClock } from './clock'
import { encodeJournalEntry, journalPath } from './journal-entry'
import { classifyStorageError, type ProjectStore, type StorageFailure } from './project-store'
import { assertStorePath } from './store-path'

export type AutosaveState = 'idle' | 'pending' | 'writing' | 'paused' | 'error'

export interface AutosaveProblem {
  readonly reason: StorageFailure
  readonly message: string
  /** True for `quota`: autosave has stopped until `resume()`. */
  readonly paused: boolean
}

export interface AutosaveOptions<S> {
  readonly history: History<S>
  readonly journal: ProjectStore
  readonly path: string
  /** The editor's own string for the document's model; the journal keeps it as is. */
  snapshot(state: S): string
  readonly clock: StorageClock
  readonly debounceMs: number
  /** The file's `mtime` when the document was opened; `undefined` for a document with no file yet. */
  readonly baseMtime?: number | undefined
  /** Called with a problem when a write fails, and with `undefined` when a later one works. */
  onproblem?(problem: AutosaveProblem | undefined): void
}

export interface Autosave {
  readonly state: AutosaveState
  /** The `mtime` the next journal entry says it was made on (after a save, the new one). */
  setBase(mtime: number | undefined): void
  /** Writes the journal now if the document has changed since it was last written; settles when that is done. */
  flush(): Promise<void>
  /** Cancels a waiting write, lets one in flight finish, then removes the journal. */
  clear(): Promise<void>
  /** Starts writing again after a `quota` pause. */
  resume(): void
  dispose(): void
}

/**
 * Keeps a journal of the document beside the real file (kit spec §4.7): every committed history step restarts a
 * debounce, and when it ends the document's snapshot is written. It follows `history.revision`, which only moves on
 * committed steps, so a drag writes nothing until it is committed. One write runs at a time, in order, so the last
 * state always wins and `clear` can never be overtaken by an older write.
 */
export function createAutosave<S>(options: AutosaveOptions<S>): Autosave {
  const { history, journal, clock } = options
  const target = journalPath(options.path)
  assertStorePath(target)

  let base = options.baseMtime ?? null
  let state: AutosaveState = 'idle'
  let timer: unknown
  let waiting = false
  let paused = false
  let disposed = false
  let seenRevision = history.revision
  let writtenRevision: number | undefined
  let reported = false
  let queue: Promise<void> = Promise.resolve()

  // The history's own meaning of dirty: the revision moved since `markClean`. Undoing back to the saved state moves
  // it too, so such a document is still journaled (the journal then equals the file, which does no harm).
  const dirty = (): boolean => history.revision !== history.cleanRevision

  const enqueue = (task: () => Promise<void>): Promise<void> => {
    queue = queue.then(task)
    return queue
  }

  const cancelWait = (): void => {
    if (waiting) clock.clearTimer(timer)
    waiting = false
  }

  const settleState = (): void => {
    state = paused ? 'paused' : waiting ? 'pending' : 'idle'
  }

  const report = (problem: AutosaveProblem | undefined): void => {
    if (problem === undefined && !reported) return
    reported = problem !== undefined
    options.onproblem?.(problem)
  }

  const fail = (reason: StorageFailure, message: string): void => {
    paused = reason === 'quota'
    state = paused ? 'paused' : 'error'
    report({ reason, message, paused })
  }

  const writeNow = async (): Promise<void> => {
    if (disposed || paused || !dirty() || writtenRevision === history.revision) return
    const revision = history.revision
    let entry: string
    try {
      entry = encodeJournalEntry({
        path: options.path,
        savedAt: clock.now(),
        baseMtime: base,
        payload: options.snapshot(history.state),
      })
    } catch (error) {
      fail('io', classifyStorageError(error).message)
      return
    }
    state = 'writing'
    const result = await journal.write(target, entry)
    if (result.ok) {
      writtenRevision = revision
      report(undefined)
      settleState()
    } else if (result.reason === 'conflict') {
      // Unreachable (no `expected` is passed); treated as an io failure rather than ignored.
      fail('io', result.message)
    } else {
      fail(result.reason, result.message)
    }
  }

  const arm = (): void => {
    cancelWait()
    waiting = true
    timer = clock.setTimer(options.debounceMs, () => {
      waiting = false
      void enqueue(writeNow)
    })
    if (state !== 'writing') state = 'pending'
  }

  const unsubscribe = history.subscribe(() => {
    if (disposed || history.revision === seenRevision) return
    seenRevision = history.revision
    if (!paused) arm()
  })

  const autosave: Autosave = {
    get state() {
      return state
    },
    setBase(mtime) {
      base = mtime ?? null
    },
    flush() {
      cancelWait()
      return enqueue(writeNow)
    },
    clear() {
      cancelWait()
      return enqueue(async () => {
        // A journal that cannot be removed is harmless: `findRecovery` ignores one older than the file.
        await journal.remove(target).catch(() => undefined)
        if (!waiting) settleState()
      })
    },
    resume() {
      if (!paused) return
      paused = false
      settleState()
      if (dirty() && !disposed) arm()
    },
    dispose() {
      disposed = true
      cancelWait()
      unsubscribe()
    },
  }
  return autosave
}
