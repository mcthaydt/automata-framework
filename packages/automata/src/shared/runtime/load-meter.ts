import { Duration, Effect } from 'effect'
import { LoadStalled } from './boot-error.js'

/** A download that makes no progress for this long, in ms, fails `LoadStalled`. */
export const STALL_MS = 30_000
/** After this long, in ms, a download still running is reported slow (the loader says so). */
export const SLOW_MS = 8_000

export interface GuardInfo {
  readonly url: string
  readonly bytesSoFar?: () => number
  readonly onSlow?: () => void
}

/**
 * Watches downloads: `guard` fails a wait with `LoadStalled` after `STALL_MS` without progress, and calls its
 * `onSlow` after `SLOW_MS`.
 */
export interface LoadMeter {
  progress(): void
  guard<A, E, R>(wait: Effect.Effect<A, E, R>, info: GuardInfo): Effect.Effect<A, E | LoadStalled, R>
}

/**
 * Creates a load meter that enforces stall and slow timeouts on asset downloads.
 * Extracted from FloorFifty's load-meter.ts.
 *
 * Uses Effect.raceFirst rather than a plain race so that whichever branch settles
 * first (the wait completing or the watcher timing out) interrupts the other immediately.
 */
export const makeLoadMeter: Effect.Effect<LoadMeter> = Effect.gen(function* () {
  const clock = yield* Effect.clock
  let lastReport = clock.unsafeCurrentTimeMillis()
  let activeGuards = 0

  const progress = () => {
    lastReport = clock.unsafeCurrentTimeMillis()
  }

  const guard = <A, E, R>(
    wait: Effect.Effect<A, E, R>,
    info: GuardInfo,
  ): Effect.Effect<A, E | LoadStalled, R> => {
    return Effect.scoped(
      Effect.gen(function* () {
        if (activeGuards === 0) {
          lastReport = clock.unsafeCurrentTimeMillis()
        }
        activeGuards++

        if (info.onSlow) {
          yield* Effect.forkScoped(
            Effect.sleep(Duration.millis(SLOW_MS)).pipe(Effect.andThen(Effect.sync(info.onSlow))),
          )
        }

        const watcher: Effect.Effect<never, LoadStalled> = Effect.gen(function* () {
          while (true) {
            const now = clock.unsafeCurrentTimeMillis()
            const elapsed = now - lastReport
            if (elapsed >= STALL_MS) {
              return yield* Effect.fail(
                new LoadStalled({
                  url: info.url,
                  bytesSoFar: info.bytesSoFar ? info.bytesSoFar() : 0,
                  stalledMs: STALL_MS,
                }),
              )
            }
            yield* Effect.sleep(Duration.millis(STALL_MS - elapsed))
          }
        })

        const result = yield* Effect.raceFirst(wait, watcher)
        lastReport = clock.unsafeCurrentTimeMillis()
        return result
      }).pipe(
        Effect.ensuring(
          Effect.sync(() => {
            activeGuards--
          }),
        ),
      ),
    )
  }

  return { progress, guard }
})
