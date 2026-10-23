import { type Duration, Effect, type Scope } from 'effect'

/**
 * What the game does when the host closes it.
 *
 * `Ruken.init` calls every `exiting` listener at once and answers the host when
 * all have returned, so a game's last write and the host flush would race: the
 * flush can leave before the write reaches the SDK's outbox. AF registers one
 * SDK listener and runs, in this order, the handlers screens and services
 * registered (registration order), then `last` (the host flush), all inside one
 * `cap`. The host is answered when that is done or the cap passes, whichever is
 * first.
 *
 * A handler that fails is logged and the next one still runs. A handler that
 * never returns uses up the cap, so the steps after it are skipped; the host is
 * still answered in time.
 */
export interface ExitHandlers {
  /** Runs `handler` on exit until the scope closes. */
  register(handler: Effect.Effect<void>): Effect.Effect<void, never, Scope.Scope>
  /** Runs the registered handlers in order, then `last`, within the cap. Never fails. */
  run(last: Effect.Effect<void>): Effect.Effect<void>
}

interface Registration {
  readonly handler: Effect.Effect<void>
  /** Set when the registering scope closes, including while an exit is already running. */
  released: boolean
}

export function makeExitHandlers(cap: Duration.Duration): ExitHandlers {
  const registrations: Registration[] = []

  const guarded = (step: Effect.Effect<void>): Effect.Effect<void> =>
    step.pipe(Effect.catchAllCause((cause) => Effect.logWarning('An exiting handler failed', cause)))

  return {
    register: (handler) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          const registration: Registration = { handler, released: false }
          registrations.push(registration)
          return registration
        }),
        (registration) =>
          Effect.sync(() => {
            registration.released = true
            const index = registrations.indexOf(registration)
            if (index >= 0) registrations.splice(index, 1)
          }),
      ).pipe(Effect.asVoid),

    run: (last) =>
      Effect.gen(function* () {
        // A copy, so a scope closing during the exit cannot shift the walk.
        for (const registration of [...registrations]) {
          if (!registration.released) yield* guarded(registration.handler)
        }
        yield* guarded(last)
      }).pipe(Effect.timeoutOption(cap), Effect.asVoid),
  }
}
