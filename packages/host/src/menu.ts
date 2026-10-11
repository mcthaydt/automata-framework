import { Effect, type Scope } from 'effect'

/**
 * The game's answer to the host's "Open game menu".
 *
 * `Ruken.init` takes one `onMenuRequest` callback for the whole session, but
 * the right answer depends on the screen (a race opens its pause overlay, the
 * results screen has no menu). So screens register handlers for as long as
 * their scope is open, and the latest one answers. With none registered the
 * answer is false and the host keeps its own drawer.
 *
 * Before `session.ready` no handler is asked and the answer is false. Ruken's
 * answer 6 (docs/spikes/s6-ruken-stub.md) puts that check in the SDK, which
 * does not have it at b30d31b, so AF holds handlers back itself until
 * `markReady` (coordinator decision, 2026-10-11; raised with Ruken).
 */
export interface MenuHandlers {
  answer(): boolean
  markReady(): void
  register(handler: () => boolean): Effect.Effect<void, never, Scope.Scope>
}

export function makeMenuHandlers(): MenuHandlers {
  const handlers: (() => boolean)[] = []
  let ready = false
  return {
    markReady: () => {
      ready = true
    },
    answer: () => {
      if (!ready) return false
      const latest = handlers.at(-1)
      return latest === undefined ? false : latest()
    },
    register: (handler) =>
      Effect.acquireRelease(
        Effect.sync(() => {
          handlers.push(handler)
        }),
        () =>
          Effect.sync(() => {
            const index = handlers.lastIndexOf(handler)
            if (index >= 0) handlers.splice(index, 1)
          }),
      ),
  }
}
