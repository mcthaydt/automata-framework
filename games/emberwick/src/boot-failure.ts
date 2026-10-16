import { Cause, Data, Option } from 'effect'
import { BaseBootFailed } from './boot.ts'

// What the page says when the game cannot start (main.ts). Only a failed Ruken handshake or ready is a
// connection problem; everything else (no canvas context, a sim that can't be made, a bug) means this
// device can't run the game, and a "check your connection" message would send the player looking in the wrong
// place.

/** The renderer could not start (Pixi found no canvas context it can draw with). */
export class RendererFailed extends Data.TaggedError('RendererFailed')<{ readonly cause: unknown }> {}

/** The first sim could not be made (its world could not be created, or a module it loads failed to load). */
export class SimFailed extends Data.TaggedError('SimFailed')<{ readonly cause: unknown }> {}

export const CONNECT_FAILED = "Couldn't connect to Ruken."
export const DEVICE_FAILED = "This device can't run the game."

/**
 * Picks the message from how startGame ended. It takes the Exit's Cause rather than the error Effect.runPromise
 * rejects with: that is a FiberFailure wrapper, whose own `_tag` is never the failure's tag.
 */
export function bootFailureMessage(cause: Cause.Cause<unknown>): string {
  const failure = Cause.failureOption(cause)
  if (Option.isSome(failure) && failure.value instanceof BaseBootFailed) return CONNECT_FAILED
  return DEVICE_FAILED
}
