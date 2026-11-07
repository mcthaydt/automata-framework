// A value that tells its listeners when it changes. The room, the session and the screens read the connection, the room
// and the end of a game this way, so a screen can show them without the library choosing how it renders.

/** What a reader gets: the value now, and a way to hear it change. */
export interface Watchable<T> {
  get(): T
  /** Calls `listener` with the value after each change (not with the current one); returns the unsubscribe. */
  subscribe(listener: (value: T) => void): () => void
}

/** The owner's end of a `Watchable`: it can also set the value. */
export interface WatchableSource<T> extends Watchable<T> {
  /** Sets the value; a value equal to the current one (`Object.is`) is not announced. */
  set(value: T): void
  /** The read-only end, safe to hand out. */
  readonly view: Watchable<T>
}

export function createWatchable<T>(initial: T): WatchableSource<T> {
  let value = initial
  const listeners = new Set<(value: T) => void>()
  const get = (): T => value
  const subscribe = (listener: (value: T) => void): (() => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }
  return {
    get,
    subscribe,
    view: Object.freeze({ get, subscribe }),
    set(next) {
      if (Object.is(value, next)) return
      value = next
      // A copy, so a listener added during the announcement waits for the next change, and the `has` check skips one
      // that an earlier listener removed. Each listener is given the value *now*, not the one that started the
      // announcement: a listener that sets the value again must not leave the ones after it on the old value.
      for (const listener of [...listeners]) if (listeners.has(listener)) listener(value)
    },
  }
}
