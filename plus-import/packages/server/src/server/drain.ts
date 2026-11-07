/**
 * How a server process leaves without dropping a game (FloorFifty `drain.ts`, on Effect's `Clock`).
 *
 * A deploy starts the new build beside this one and points new connections at it; this process is then sent
 * SIGTERM. Exiting at once would end every game in progress, so the server tells each room (`RoomEngine.beginDrain`:
 * a lobby moves its players on, a game finishes first), waits for its rooms to close by themselves, and exits when
 * none is left. The wait is capped, because a room nobody leaves would otherwise hold the old build up forever.
 *
 * No Colyseus here: the room count is read through `size`, and time is Effect's `Clock`, so a test moves it with
 * `TestClock` and the cap is exact.
 */

import { Clock, Deferred, Duration, Effect, Exit, type Scope } from 'effect'
import type { SignalSource } from '../game/server-config'

/** The longest a drain waits for rooms to close: five minutes. */
export const DRAIN_MAX_MS: number = 300_000

/** How often the room count is read while draining. */
export const DRAIN_POLL_MS: number = 1_000

/** `empty` when the last room closed; `cap` when the wait ran out first. */
export type DrainResult = 'empty' | 'cap'

export function drainRooms(
  rooms: { readonly size: number },
  options: { readonly capMs?: number | undefined; readonly pollMs?: number | undefined } = {},
): Effect.Effect<DrainResult> {
  const capMs = options.capMs ?? DRAIN_MAX_MS
  const pollMs = options.pollMs ?? DRAIN_POLL_MS
  return Effect.gen(function* () {
    const deadline = (yield* Clock.currentTimeMillis) + capMs
    for (;;) {
      if (rooms.size === 0) return 'empty' as const
      const left = deadline - (yield* Clock.currentTimeMillis)
      if (left <= 0) return 'cap' as const
      yield* Effect.sleep(Duration.millis(Math.min(pollMs, left)))
    }
  })
}

/**
 * Drains on the first SIGTERM, then exits: 0 when the drain finished, 1 when it failed. The listener stays for the
 * scope and ignores every later signal: systemd can signal again and an operator's second Ctrl-C is common, and
 * Node's default handler, were the listener gone, would kill the games the first signal is waiting for.
 */
export function drainOnSigterm<E>(
  signals: SignalSource,
  drain: Effect.Effect<DrainResult, E>,
  exit: (code: number) => void,
): Effect.Effect<never, never, Scope.Scope> {
  return Effect.gen(function* () {
    const signalled = yield* Deferred.make<void>()
    const listener = (): void => {
      Deferred.unsafeDone(signalled, Exit.void)
    }
    yield* Effect.acquireRelease(
      Effect.sync(() => signals.on('SIGTERM', listener)),
      () => Effect.sync(() => signals.off('SIGTERM', listener)),
    )
    yield* Deferred.await(signalled)
    const code = yield* drain.pipe(
      Effect.as(0),
      Effect.catchAllCause(() => Effect.succeed(1)),
    )
    exit(code)
    return yield* Effect.never
  })
}
