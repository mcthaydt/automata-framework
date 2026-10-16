import { Effect } from 'effect'

/**
 * A host value the game can read now and hear about when it changes (shared contracts §1). Plain callbacks rather
 * than an Effect `Stream`, so a game that only reads host values carries no Stream code (S8 budgets E1/E3,
 * docs/spikes/s8-effect.md); `changes(observed)` turns one into a Stream for games that want that.
 */
export interface Observed<A> {
  /** The current value. Always synchronous and never fails. */
  readonly get: Effect.Effect<A>
  /**
   * Calls `onChange` with each later change (not the current value) until the returned function is called or
   * Hosting shuts down. On shutdown it calls `onEnd` once; subscribing after shutdown calls `onEnd` at once.
   */
  subscribe(onChange: (value: A) => void, onEnd?: () => void): () => void
}

/** Hosting shutting down: closed once, when its scope closes; every subscription ends then. */
export interface ShutdownSignal {
  readonly closed: boolean
  /** Calls `listener` when the signal closes, unless the returned function is called first. */
  onClose(listener: () => void): () => void
  close(): void
}

export function makeShutdownSignal(): ShutdownSignal {
  const listeners = new Set<() => void>()
  let closed = false
  return {
    get closed() {
      return closed
    },
    onClose(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    close() {
      if (closed) return
      closed = true
      const ending = [...listeners]
      listeners.clear()
      for (const listener of ending) listener()
    },
  }
}

/**
 * Wraps one of the SDK's "current value plus `on('change')`" pairs as an `Observed`. The listener is removed when
 * the subscriber unsubscribes or `shutdown` closes, whichever comes first.
 */
export function fromListener<A>(
  current: () => A,
  listen: (onChange: (value: A) => void) => () => void,
  shutdown: ShutdownSignal,
): Observed<A> {
  return {
    get: Effect.sync(current),
    subscribe(onChange, onEnd) {
      if (shutdown.closed) {
        onEnd?.()
        return () => undefined
      }
      let active = true
      const stopListening = listen((value) => {
        if (active) onChange(value)
      })
      const stop = () => {
        if (!active) return false
        active = false
        stopListening()
        stopWaiting()
        return true
      }
      const stopWaiting = shutdown.onClose(() => {
        if (stop()) onEnd?.()
      })
      return () => void stop()
    },
  }
}
