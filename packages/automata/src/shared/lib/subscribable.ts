// Replaces Effect's `Subscribable` and `Stream` for "a current value plus its changes".

/** A value that changes: read it now with `get`, or hear the current value and then each change with `subscribe`. */
export interface Subscribable<A> {
  get(): A
  /** Calls `listener` with the current value, then with every change. Returns the function that stops it. */
  subscribe(listener: (value: A) => void): () => void
}

/**
 * Wraps one of the SDK's "current value plus `on('change')`" pairs.
 *
 * The change listener is attached before the current value is read, so a change that lands between the two is never
 * lost (at worst a subscriber hears the same value twice).
 */
export function subscribable<A>(
  current: () => A,
  listen: (onChange: (value: A) => void) => () => void,
): Subscribable<A> {
  return {
    get: current,
    subscribe(listener) {
      let active = true
      const stop = listen((value) => {
        if (active) listener(value)
      })
      listener(current())
      return () => {
        if (!active) return
        active = false
        stop()
      }
    },
  }
}
