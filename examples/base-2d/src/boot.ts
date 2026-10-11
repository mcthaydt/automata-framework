import { Ruken, type RukenSession, type SdkEnv } from '@ruken/sdk'
import { Data, Effect } from 'effect'

// The connection to Ruken: the handshake, then the wait for ready. It calls the SDK directly because the
// `Hosting` service (host lane, M1.4, PR #5) is not on main yet; once it is, the base moves onto it. Opened
// outside Ruken, the SDK runs standalone and this resolves at once.

/** Must equal `[game] id` in ship.config.ts; Ruken checks it. */
export const GAME_ID = 'base-2d'

/** The handshake or the wait for ready failed (Ruken's error is kept as the cause). */
export class BaseBootFailed extends Data.TaggedError('BaseBootFailed')<{
  readonly step: 'init' | 'ready'
  readonly cause: unknown
}> {}

export interface ConnectOptions {
  /** The host's "Open game menu". Return false when the menu cannot open right now. */
  readonly onMenuRequest: () => boolean
  /** The fake host's environment in tests; the real window when omitted. */
  readonly env?: SdkEnv | undefined
}

export function connect(options: ConnectOptions): Effect.Effect<RukenSession, BaseBootFailed> {
  return Effect.gen(function* () {
    // Ruken does not refuse menu.open before session.ready (a known item sent to Ruken, docs/03), so the game
    // refuses it itself until the host says ready: there is no game to pause yet.
    let ready = false
    const session = yield* Effect.tryPromise({
      try: () =>
        Ruken.init(
          {
            gameId: GAME_ID,
            // 'menu' lets the host's "Open game menu" reach the game; the host grants it only with onMenuRequest set.
            wants: ['menu'],
            pauseBehavior: 'pause',
            onMenuRequest: () => ready && options.onMenuRequest(),
          },
          options.env,
        ),
      catch: (cause) => new BaseBootFailed({ step: 'init', cause }),
    })
    yield* Effect.tryPromise({
      try: () => session.ready,
      catch: (cause) => new BaseBootFailed({ step: 'ready', cause }),
    })
    ready = true
    return session
  })
}
