import { type GitEngine, OfflineError, SyncStopped } from './git-engine'
import {
  commitMessage,
  createStatusStore,
  type StatusStore,
  savedWithNotes,
  statusOf,
  stoppedStatus,
} from './sync-status'

// Keeps a game and its GitHub repository in step while the app is open: it pulls when it starts, when the app comes
// back to the front and every minute; it commits what the person edited once they stop for ten seconds, as one
// commit, and pushes it. A push that cannot go (no internet, signed out) leaves the commit in place, and the next
// pull pushes that same commit, so a game never gets two commits for one edit.

export interface Timers {
  after(ms: number, run: () => void): () => void
  every(ms: number, run: () => void): () => void
}

export interface Visibility {
  isVisible(): boolean
  onChange(listener: () => void): () => void
}

export interface SyncOptions {
  readonly engine: GitEngine
  /** Told which files a pull changed, so the open editors reload them. */
  readonly store: { notifyChanged(paths: readonly string[]): void }
  readonly timers: Timers
  readonly visibility: Visibility
  readonly isSignedIn: () => Promise<boolean>
  /** The clock a `SyncStopped` wait is read against; the page's by default. */
  readonly now?: () => number
  /** Called with anything unexpected; the status then says the game is not on GitHub yet. */
  readonly onError?: (error: unknown) => void
}

export interface SyncHandle {
  readonly status: StatusStore
  /** The person saved these files. */
  edited(paths: readonly string[]): void
  /** Pulls now (and pushes what is waiting). */
  pullNow(): Promise<void>
  stop(): void
}

const PULL_EVERY_MS = 60_000
const SAVE_AFTER_MS = 10_000

export function startSync(options: SyncOptions): SyncHandle {
  const { engine, store, timers, visibility, isSignedIn } = options
  const status = createStatusStore(statusOf('saved'))
  let stopped = false
  /** The engine said it can't go on: nothing is pulled or pushed until `until`, or until the person acts. */
  let paused: { readonly until: number | undefined } | undefined
  const now = options.now ?? Date.now
  const isPaused = (): boolean => {
    if (paused === undefined) return false
    if (paused.until !== undefined && now() >= paused.until) paused = undefined
    return paused !== undefined
  }
  let conflict = false
  /** Generated files edited on GitHub, which the line mentions until the next pull brings something else. */
  let notes: readonly string[] = []
  let chain: Promise<void> = Promise.resolve()
  let waiting: string[] = []
  let cancelSave: (() => void) | undefined

  /** One thing at a time: a pull never runs inside a commit. */
  const queue = (work: () => Promise<void>): Promise<void> => {
    chain = chain.then(async () => {
      if (stopped) return
      try {
        await work()
      } catch (error) {
        if (error instanceof SyncStopped) {
          paused = { until: error.until }
          status.set(stoppedStatus(error.words))
          return
        }
        if (!(error instanceof OfflineError)) options.onError?.(error)
        status.set(statusOf('offline'))
      }
    })
    return chain
  }

  const settled = (): void =>
    status.set(conflict ? statusOf('conflict') : notes.length > 0 ? savedWithNotes(notes) : statusOf('saved'))

  async function bringIn(): Promise<void> {
    if ((await engine.fetchMain()) === 'unchanged') return
    const outcome = await engine.mergeMain()
    if (outcome.changed.length > 0) store.notifyChanged(outcome.changed)
    conflict = outcome.asks.length > 0
    notes = outcome.generated
  }

  /** Pushes what is waiting; if GitHub moved on, brings that in and tries once more. Never forces. */
  async function pushWaiting(again = false): Promise<void> {
    if (!(await engine.hasUnpushed())) return settled()
    const result = await engine.push()
    if (result === 'offline') return status.set(statusOf('offline'))
    if (result === 'rejected') {
      if (again) {
        conflict = true
        return settled()
      }
      await bringIn()
      return pushWaiting(true)
    }
    settled()
  }

  async function pull(): Promise<void> {
    if (isPaused()) return
    if (!(await isSignedIn())) return status.set(statusOf('signed-out'))
    status.set(statusOf('pulling'))
    await bringIn()
    await pushWaiting()
    if (status.get().state === 'pulling') settled()
  }

  async function save(): Promise<void> {
    const paths = waiting
    waiting = []
    if (paths.length === 0) return
    await engine.commitAll(commitMessage(paths))
    if (isPaused()) return
    if (!(await isSignedIn())) return status.set(statusOf('signed-out'))
    await pushWaiting()
  }

  const pullIfVisible = (): void => {
    if (visibility.isVisible()) void queue(pull)
  }

  void queue(pull)
  const stopEvery = timers.every(PULL_EVERY_MS, pullIfVisible)
  const stopVisibility = visibility.onChange(pullIfVisible)

  return {
    status,
    edited(paths) {
      if (stopped || paths.length === 0) return
      waiting.push(...paths)
      cancelSave?.()
      cancelSave = timers.after(SAVE_AFTER_MS, () => void queue(save))
    },
    pullNow: () => {
      paused = undefined
      return queue(pull)
    },
    stop() {
      stopped = true
      cancelSave?.()
      stopEvery()
      stopVisibility()
    },
  }
}
