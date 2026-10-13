// How the demo's boot can fail, in base-2d's terms, so base-2d's bootPage shows the right message
// ("Couldn't connect to Ruken." or "This device can't run the game.") and sets data-state="failed".
import { BaseBootFailed, SimFailed } from '@af-examples/base-2d'
import { Effect } from 'effect'

/** The host handshake or ready: the only failure that is the connection's fault. */
export function hostReady<A, E, R>(connect: Effect.Effect<A, E, R>): Effect.Effect<A, BaseBootFailed, R> {
  return Effect.mapError(connect, (cause) => new BaseBootFailed({ step: 'ready', cause }))
}

/**
 * Starting the room: the renderer and the first sim. A rejection here (Rapier's wasm refused, no canvas context)
 * means this device can't run the game. A typed failure, not Effect.promise's defect, so bootPage can tell.
 */
export function playBodies<A>(start: () => Promise<A>): Effect.Effect<A, SimFailed> {
  return Effect.tryPromise({ try: start, catch: (cause) => new SimFailed({ cause }) })
}
