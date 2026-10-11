import { Effect, Stream, Subscribable } from 'effect'

/**
 * Wraps one of the SDK's "current value plus `on('change')`" pairs as an Effect
 * `Subscribable`.
 *
 * `changes` starts with the current value, then each change, like
 * `SubscriptionRef.changes`. The listener is registered before the current
 * value is read, so a change that lands between the two is never lost (at
 * worst a subscriber sees the same value twice). The listener is removed when
 * the stream ends.
 */
export function fromListener<A>(
  current: () => A,
  listen: (onChange: (value: A) => void) => () => void,
): Subscribable.Subscribable<A> {
  return Subscribable.make({
    get: Effect.sync(current),
    changes: Stream.async<A>((emit) => {
      const stop = listen((value) => {
        void emit.single(value)
      })
      void emit.single(current())
      return Effect.sync(stop)
    }),
  })
}

/** A value that never changes, for what a standalone page cannot observe. */
export function constant<A>(value: A): Subscribable.Subscribable<A> {
  return Subscribable.make({ get: Effect.succeed(value), changes: Stream.make(value) })
}
