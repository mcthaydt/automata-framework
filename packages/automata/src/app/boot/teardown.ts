// What one boot attempt holds open, closed together: the plain stand-in for the Effect `Scope` boot used to run in.
// Unlike `Disposables`, an undo may be async (the flow leaves its screen, the save flushes), and `close` waits for each
// before running the next, last added first, as Effect's finalizers did.

/** One boot attempt's undo stack. */
export interface Teardown {
  /** Runs `undo` at `close`. Added after `close` started, it runs at once, so a late arrival is never leaked. */
  add(undo: () => void | Promise<void>): void
  /** Runs every undo, last added first, each awaited. A failing undo is reported and the rest still run. Once. */
  close(): Promise<void>
  readonly closed: boolean
}

/** Makes an empty `Teardown`; `report` hears an undo that threw (default `console.error`). */
export function teardown(report: (cause: unknown) => void = (cause) => console.error(cause)): Teardown {
  const pending: Array<() => void | Promise<void>> = []
  let closed = false
  const run = async (undo: () => void | Promise<void>): Promise<void> => {
    try {
      await undo()
    } catch (cause) {
      report(cause)
    }
  }
  return {
    get closed() {
      return closed
    },
    add(undo) {
      if (closed) void run(undo)
      else pending.push(undo)
    },
    async close() {
      if (closed) return
      closed = true
      for (const undo of pending.splice(0).reverse()) await run(undo)
    },
  }
}
