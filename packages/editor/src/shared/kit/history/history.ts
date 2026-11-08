/** Steps kept before the oldest drops. */
const DEFAULT_LIMIT = 500
/** Two applies with one coalesce key closer than this are one step (EDK-D5). */
const DEFAULT_COALESCE_WINDOW_MS = 600

export type HistoryErrorCode = 'transaction-open'

/** A misuse of the history that the editor can name: today, a second transaction (or an apply) while one is open. */
export class HistoryError extends Error {
  readonly code: HistoryErrorCode

  constructor(code: HistoryErrorCode, message: string) {
    super(message)
    this.name = 'HistoryError'
    this.code = code
  }
}

export interface HistoryOptions {
  /** Steps kept; the oldest drops silently. Default 500. */
  readonly limit?: number
  /** Milliseconds, injected so coalescing tests use a fake clock. Default `performance.now`. */
  readonly now?: () => number
  /** Two applies with the same coalesce key within this many ms are one step. Default 600. */
  readonly coalesceWindowMs?: number
}

export interface Transaction<S> {
  /** False once it was committed, cancelled, or cancelled by an undo; a closed transaction ignores every call. */
  readonly open: boolean
  update(fn: (state: S) => S): void
  commit(): void
  cancel(): void
}

export interface History<S> {
  /** The live state, including the updates of an open transaction. */
  readonly state: S
  /** Moves on every apply, undo, redo and commit; not on a transaction's live updates. */
  readonly revision: number
  /** The revision `markClean` last saw; the document is dirty when it differs from `revision`. */
  readonly cleanRevision: number
  /** True while a transaction is open too: undo then cancels it. */
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly undoLabel: string | undefined
  readonly redoLabel: string | undefined
  /**
   * Records one step. An update that returns the same object records nothing. With `coalesce`, an apply that
   * follows another with the same key inside the window joins its step (typing or scrubbing one field). With `join`,
   * an apply that follows another with the same join key joins its step however long the pause between them: a
   * person's visit to one field is one step. Throws `HistoryError` while a transaction is open.
   */
  apply(label: string, update: (state: S) => S, options?: { coalesce?: string; join?: string }): void
  /** Opens a transaction: its updates show live and commit as one step. Throws while one is already open. */
  begin(label: string): Transaction<S>
  /** Undoes one step; while a transaction is open, cancels it and does nothing else. */
  undo(): void
  /** Redoes one step; does nothing while a transaction is open. */
  redo(): void
  markClean(): void
  subscribe(listener: (history: History<S>) => void): () => void
}

interface Step<S> {
  label: string
  readonly before: S
  after: S
  /** The coalesce key of the apply that made it, and when that apply (or the last one joined) happened. */
  key: string | undefined
  /** The join key of the apply that made it: the visit to a field the step is one edit of. */
  join: string | undefined
  at: number
}

interface OpenTransaction<S> {
  readonly label: string
  readonly before: S
  readonly handle: Transaction<S>
}

/**
 * The editor's undo history over immutable document snapshots: each step keeps the
 * state before and after it, so undo and redo are exact and need no patch language.
 */
export function createHistory<S>(initial: S, options: HistoryOptions = {}): History<S> {
  const limit = options.limit ?? DEFAULT_LIMIT
  const now = options.now ?? (() => performance.now())
  const window = options.coalesceWindowMs ?? DEFAULT_COALESCE_WINDOW_MS
  let state = initial
  let revision = 0
  let cleanRevision = 0
  const done: Step<S>[] = []
  const undone: Step<S>[] = []
  let transaction: OpenTransaction<S> | undefined
  // The step that may still absorb a coalescing apply: set by an apply with a key, cleared by anything else.
  let joinable: Step<S> | undefined
  const listeners = new Set<(history: History<S>) => void>()

  const changed = (): void => {
    for (const listener of [...listeners]) listener(history)
  }

  const record = (step: Step<S>): void => {
    done.push(step)
    if (done.length > limit) done.shift()
    undone.length = 0
    state = step.after
    revision += 1
  }

  const cancelTransaction = (open: OpenTransaction<S>): void => {
    transaction = undefined
    state = open.before
    changed()
  }

  const begin = (label: string): Transaction<S> => {
    if (transaction !== undefined) {
      throw new HistoryError('transaction-open', `a transaction ("${transaction.label}") is already open`)
    }
    joinable = undefined
    const open: OpenTransaction<S> = {
      label,
      before: state,
      handle: {
        get open() {
          return transaction === open
        },
        update(fn) {
          if (transaction !== open) return
          state = fn(state)
          changed()
        },
        commit() {
          if (transaction !== open) return
          transaction = undefined
          if (state !== open.before)
            record({ label, before: open.before, after: state, key: undefined, join: undefined, at: now() })
          changed()
        },
        cancel() {
          if (transaction !== open) return
          cancelTransaction(open)
        },
      },
    }
    transaction = open
    return open.handle
  }

  const history: History<S> = {
    get state() {
      return state
    },
    get revision() {
      return revision
    },
    get cleanRevision() {
      return cleanRevision
    },
    get canUndo() {
      return transaction !== undefined || done.length > 0
    },
    get canRedo() {
      return transaction === undefined && undone.length > 0
    },
    get undoLabel() {
      return transaction?.label ?? done[done.length - 1]?.label
    },
    get redoLabel() {
      return transaction === undefined ? undone[undone.length - 1]?.label : undefined
    },
    apply(label, update, applyOptions) {
      if (transaction !== undefined) {
        throw new HistoryError(
          'transaction-open',
          `cannot apply "${label}" inside the open transaction "${transaction.label}"`,
        )
      }
      const next = update(state)
      if (next === state) return
      const key = applyOptions?.coalesce
      const join = applyOptions?.join
      const at = now()
      const joins =
        (join !== undefined && joinable?.join === join) ||
        (key !== undefined && joinable?.key === key && joinable !== undefined && at - joinable.at <= window)
      if (joinable !== undefined && joins) {
        joinable.label = label
        joinable.after = next
        joinable.at = at
        state = next
        revision += 1
      } else {
        const step: Step<S> = { label, before: state, after: next, key, join, at }
        record(step)
        joinable = key === undefined && join === undefined ? undefined : step
      }
      changed()
    },
    begin,
    undo() {
      joinable = undefined
      if (transaction !== undefined) {
        cancelTransaction(transaction)
        return
      }
      const step = done.pop()
      if (step === undefined) return
      undone.push(step)
      state = step.before
      revision += 1
      changed()
    },
    redo() {
      joinable = undefined
      if (transaction !== undefined) return
      const step = undone.pop()
      if (step === undefined) return
      done.push(step)
      state = step.after
      revision += 1
      changed()
    },
    markClean() {
      cleanRevision = revision
      changed()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
  return history
}
