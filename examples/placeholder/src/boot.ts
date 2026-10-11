import { Ruken, type RukenSession, type SdkEnv } from '@ruken/sdk'
import { Data, Effect } from 'effect'

// The placeholder's whole boot: the Ruken handshake, then one line of text. It is the ship lane's proof that a
// build made by AF's pipeline completes Ruken's handshake (ship spec §1, item 5) and renders nothing before
// the host says ready (Ruken R-04). It talks to the SDK directly because the `Hosting` service (host lane,
// M1.4) does not exist yet; once it does, the placeholder moves onto it.

/** Must equal `[game] id` in ship.config.ts; Ruken checks it. */
export const GAME_ID = 'placeholder'

/** The handshake or the wait for ready failed (Ruken's error is kept as the cause). */
export class PlaceholderBootFailed extends Data.TaggedError('PlaceholderBootFailed')<{
  readonly step: 'init' | 'ready'
  readonly cause: unknown
}> {}

export interface BootOptions {
  /** Where the line of text goes (the page's #game element; a plain object in tests). */
  readonly root: { textContent: string | null }
  /** The fake host's environment in tests; the real window when omitted. */
  readonly env?: SdkEnv | undefined
}

export function boot(options: BootOptions): Effect.Effect<RukenSession, PlaceholderBootFailed> {
  return Effect.gen(function* () {
    const session = yield* Effect.tryPromise({
      try: () => Ruken.init({ gameId: GAME_ID, wants: [], pauseBehavior: 'pause' }, options.env),
      catch: (cause) => new PlaceholderBootFailed({ step: 'init', cause }),
    })
    yield* Effect.tryPromise({
      try: () => session.ready,
      catch: (cause) => new PlaceholderBootFailed({ step: 'ready', cause }),
    })
    options.root.textContent = `Ready. Hello, ${session.player.displayName}.`
    return session
  })
}
