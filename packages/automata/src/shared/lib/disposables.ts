// Replaces Effect's `Scope` and finalizers: a place to put "undo this" functions and run them all at once.
// Every factory in the package that opens a listener, a timer or a child returns `{ dispose }` built on this.

/** A list of "undo this" functions, run together once: what a screen, a run or a service holds open. */
export interface Disposables {
  /**
   * Runs `undo` at disposal. Added after disposal it runs at once, so a late arrival is never leaked. Returns a
   * function that takes `undo` back out (a listener that was stopped by hand has nothing left to undo).
   */
  add(undo: () => void): () => void
  /** Runs what was added, last added first, once. Later calls do nothing. */
  dispose(): void
  readonly disposed: boolean
}

/** Makes an empty `Disposables`. */
export function disposables(): Disposables {
  const pending: Array<() => void> = []
  let disposed = false
  return {
    get disposed() {
      return disposed
    },
    add(undo) {
      if (disposed) {
        undo()
        return () => undefined
      }
      pending.push(undo)
      return () => {
        const index = pending.indexOf(undo)
        if (index >= 0) pending.splice(index, 1)
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      // One failing undo must not leave the rest running forever: run them all, then report the first failure.
      let failed = false
      let firstError: unknown
      // Taken out of the bag first: an undo may call the remover `add` gave it, which would shift a live array.
      for (const undo of pending.splice(0).reverse()) {
        try {
          undo()
        } catch (error) {
          if (!failed) {
            failed = true
            firstError = error
          }
        }
      }
      if (failed) throw firstError
    },
  }
}
