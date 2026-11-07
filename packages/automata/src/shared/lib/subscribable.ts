// Replaces Effect's `Subscribable` and `Stream` for "a current value plus its changes", and for plain events.
import type { Disposables } from './disposables'

/** Things that happen: hear them from the moment you subscribe; nothing is replayed. */
export interface Listenable<A> {
  /** Calls `listener` with each event. Returns the function that stops it. */
  subscribe(listener: (value: A) => void): () => void
}

/** A value that changes: read it now with `get`, or hear the current value and then each change with `subscribe`. */
export interface Subscribable<A> extends Listenable<A> {
  get(): A
  /** Calls `listener` with the current value, then with every change. Returns the function that stops it. */
  subscribe(listener: (value: A) => void): () => void
}

/**
 * Wraps one of the SDK's "current value plus `on('change')`" pairs.
 *
 * The change listener is attached before the current value is read, so a change that lands between the two is never
 * lost (at worst a subscriber hears the same value twice).
 *
 * With an `owner`, disposing it stops every subscription still running: this is how "the stream ends when Hosting
 * shuts down" is kept without a stream.
 */
export function subscribable<A>(
  current: () => A,
  listen: (onChange: (value: A) => void) => () => void,
  owner?: Disposables,
): Subscribable<A> {
  return {
    get: current,
    subscribe(listener) {
      let active = true
      const stopListening = listen((value) => {
        if (active) listener(value)
      })
      let release = (): void => undefined
      const stop = (): void => {
        if (!active) return
        active = false
        release()
        stopListening()
      }
      release = owner?.add(stop) ?? release
      listener(current())
      return stop
    },
  }
}

/** Something that announces events: `emit` tells every current listener; `events` is what others subscribe to. */
export function emitter<A>(owner?: Disposables): { emit(value: A): void; readonly events: Listenable<A> } {
  const listeners = new Set<(value: A) => void>()
  return {
    emit(value) {
      // A copy, so a listener that stops itself during delivery does not skip the next one.
      for (const listener of [...listeners]) if (listeners.has(listener)) listener(value)
    },
    events: {
      subscribe(listener) {
        listeners.add(listener)
        let release = (): void => undefined
        const stop = (): void => {
          listeners.delete(listener)
          release()
        }
        release = owner?.add(stop) ?? release
        return stop
      },
    },
  }
}
