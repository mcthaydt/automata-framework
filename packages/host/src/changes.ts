import { Effect, Stream } from 'effect'
import type { Observed } from './observed'

/**
 * An `Observed` value as a Stream: the current value, then each change, like `SubscriptionRef.changes`; it ends
 * when Hosting shuts down. Only games that import this carry Stream code (S8 budgets, shared contracts §1).
 *
 * The current value is read and the subscription made in one synchronous step, so no change can land between
 * them.
 */
export function changes<A>(observed: Observed<A>): Stream.Stream<A> {
  return Stream.async<A>((emit) => {
    void emit.single(Effect.runSync(observed.get))
    const unsubscribe = observed.subscribe(
      (value) => void emit.single(value),
      () => void emit.end(),
    )
    return Effect.sync(unsubscribe)
  })
}
