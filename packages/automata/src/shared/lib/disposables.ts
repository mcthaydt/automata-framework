// Replaces Effect's `Scope` and finalizers: a place to put "undo this" functions and run them all at once.
// Every factory in the package that opens a listener, a timer or a child returns `{ dispose }` built on this.

export interface Disposables {
  /** Runs `undo` at disposal. Added after disposal it runs at once, so a late arrival is never leaked. */
  add(undo: () => void): void
  /** Runs what was added, last added first, once. Later calls do nothing. */
  dispose(): void
  readonly disposed: boolean
}

export function disposables(): Disposables {
  const pending: Array<() => void> = []
  let disposed = false
  return {
    get disposed() {
      return disposed
    },
    add(undo) {
      if (disposed) undo()
      else pending.push(undo)
    },
    dispose() {
      if (disposed) return
      disposed = true
      // One failing undo must not leave the rest running forever: run them all, then report the first failure.
      let failed = false
      let firstError: unknown
      for (const undo of pending.reverse()) {
        try {
          undo()
        } catch (error) {
          if (!failed) {
            failed = true
            firstError = error
          }
        }
      }
      pending.length = 0
      if (failed) throw firstError
    },
  }
}
