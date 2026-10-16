import type { Hosting, HostingSeams } from '@mcthaydt/automata-host'
import { makeHosting } from '@mcthaydt/automata-host/target'
import { Data, Effect, type Scope } from 'effect'

// The connection to the host through `Hosting`: the handshake, then the wait for ready. The build's target picks
// the adapter (`@mcthaydt/automata-host/target`, PUB spec §3): Ruken's for `pnpm build`, which runs standalone
// when opened outside Ruken, and the web adapter for `pnpm build:itch`, which is ready at once.

/** Must equal `[game] id` in ship.config.ts; Ruken checks it. */
export const GAME_ID = 'base-2d'

/** The handshake or the wait for ready failed (the host's error is kept as the cause). */
export class BaseBootFailed extends Data.TaggedError('BaseBootFailed')<{
  readonly step: 'init' | 'ready'
  readonly cause: unknown
}> {}

export interface ConnectOptions {
  /** The host's "Open game menu". Return false when the menu cannot open right now. */
  readonly onMenuRequest: () => boolean
  /** The fake host's environment in tests; the real window when omitted. */
  readonly seams?: HostingSeams | undefined
}

/** `Hosting` once the host says ready; it lives, and answers the host's menu, as long as the scope. */
export function connect(options: ConnectOptions): Effect.Effect<Hosting, BaseBootFailed, Scope.Scope> {
  return Effect.gen(function* () {
    const hosting = yield* makeHosting(
      // 'menu' lets the host's "Open game menu" reach the game; the host grants it only with a handler set.
      { gameId: GAME_ID, wants: ['menu'], pauseBehavior: 'pause' },
      options.seams,
    ).pipe(Effect.mapError((cause) => new BaseBootFailed({ step: 'init', cause })))
    // `Hosting` refuses the host's menu until the session is ready: there is no game to pause before then.
    yield* hosting.onMenuRequest(options.onMenuRequest)
    yield* hosting.ready.pipe(Effect.mapError((cause) => new BaseBootFailed({ step: 'ready', cause })))
    return hosting
  })
}
