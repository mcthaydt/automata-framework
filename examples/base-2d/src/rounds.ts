// Each round plays on a fresh sim, and making one is asynchronous. Play, Quit and Play again faster than a
// sim is made would otherwise start two creations: the slower one would overwrite the faster, leak a Koota
// world (Koota allows 16) and could leave the loop stepping a disposed sim. Each start takes a number; only
// the newest start's sim is kept, and any older one that arrives later is disposed straight away.

export interface Rounds<S> {
  /** The sim to step. While a round is starting it is the old, disposed sim: don't step it. */
  current(): S
  /** True from `start()` until the newest round's sim has arrived. */
  starting(): boolean
  /** Disposes the current sim (once) and makes a fresh one; `onReady` runs when the newest arrives. */
  start(): void
}

export function createRounds<S extends { dispose(): void }>(
  first: S,
  create: () => Promise<S>,
  onReady: (sim: S) => void,
): Rounds<S> {
  let sim = first
  let latest = 0
  let starting = false
  return {
    current: () => sim,
    starting: () => starting,
    start() {
      // While a round is starting the old sim is already disposed; dispose it only on the first start.
      if (!starting) sim.dispose()
      starting = true
      const round = ++latest
      void create().then((fresh) => {
        if (round !== latest) {
          fresh.dispose()
          return
        }
        sim = fresh
        starting = false
        onReady(fresh)
      })
    },
  }
}
