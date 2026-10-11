// Each round plays on a fresh sim, and making one is asynchronous. Play, Quit and Play again faster than a
// sim is made must not start overlapping creations: each holds a Koota world (Koota allows 16), the slower
// could overwrite the faster, and the loop could step a disposed sim. So one sim is made at a time. A start
// that arrives while one is being made only marks that another is wanted; when the sim in progress arrives it
// is disposed and the newest start's sim is made instead. At most two sims are alive at once.

export interface Rounds<S> {
  /** The sim to step. While a round is starting it is the old, disposed sim: don't step it. */
  current(): S
  /** True from `start()` until the newest round's sim has arrived (or failed). */
  starting(): boolean
  /** Disposes the current sim (once) and makes a fresh one. */
  start(): void
}

export interface RoundCallbacks<S> {
  /** The newest round's sim has arrived and is current. */
  readonly onReady: (sim: S) => void
  /** Making a sim failed; no round is starting any more. */
  readonly onFailed: (error: unknown) => void
}

export function createRounds<S extends { dispose(): void }>(
  first: S,
  create: () => Promise<S>,
  callbacks: RoundCallbacks<S>,
): Rounds<S> {
  let sim = first
  let starting = false
  let making = false
  let wantAnother = false

  const make = () => {
    making = true
    create().then(
      (fresh) => {
        making = false
        if (wantAnother) {
          // A newer start came in while this sim was being made: this one is stale.
          wantAnother = false
          fresh.dispose()
          make()
          return
        }
        sim = fresh
        starting = false
        callbacks.onReady(fresh)
      },
      (error: unknown) => {
        making = false
        wantAnother = false
        starting = false
        callbacks.onFailed(error)
      },
    )
  }

  return {
    current: () => sim,
    starting: () => starting,
    start() {
      // While a round is starting the old sim is already disposed; dispose it only on the first start.
      if (!starting) sim.dispose()
      starting = true
      if (making) wantAnother = true
      else make()
    },
  }
}
