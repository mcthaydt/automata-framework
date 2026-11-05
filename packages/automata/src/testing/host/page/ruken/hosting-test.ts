import type { SdkEnv } from '@ruken/sdk'
import { createFakeHost, type FakeHost, type FakeHostOptions } from '@ruken/sdk-host/testing'
import { Context, Effect, Layer } from 'effect'
import { makeHosting } from '../../../../features/targets/ruken/hosting-ruken'
import type { HostError } from '../../../../shared/host/errors'
import { Hosting, type HostingOptions } from '../../../../shared/host/hosting'
import { realClock } from '../clocks'

/** The fake host behind `HostingTest`, for tests that drive the host side. */
export interface FakeHostHandle {
  readonly host: FakeHost
  /** Every message of `type` the game sent the host, as payloads, in order. */
  sentByGame(type: string): unknown[]
}

export const FakeHostHandle: Context.Tag<FakeHostHandle, FakeHostHandle> = Context.GenericTag<FakeHostHandle>(
  '@mcthaydt/automata-host/FakeHostHandle',
)

/**
 * What to change about `HostingTest`'s defaults: the game's hosting options, the fake host, the SDK
 * environment and the game's origin.
 */
export interface HostingTestOptions {
  /** Overrides for the game's options; the defaults ask for saves and pause in the menu. */
  readonly hosting?: Partial<HostingOptions>
  /** Overrides for `createFakeHost` (clock, grants, seeded saves, consent, scripted UI and ads). */
  readonly host?: Partial<Omit<FakeHostOptions, 'gameOrigin' | 'gameId'>>
  /** Rewrites the game's `SdkEnv`, for example to forge where messages come from. */
  readonly env?: (env: SdkEnv) => SdkEnv
  /** Where the game is served from; the SDK's allowlist depends on it. Defaults to `TEST_GAME_ORIGIN`. */
  readonly gameOrigin?: string
}

/** The origin `HostingTest` serves the game from unless `gameOrigin` says otherwise. */
export const TEST_GAME_ORIGIN = 'http://localhost:4400'

/**
 * `HostingLive` wired to `@ruken/sdk-host`'s fake host over in-memory ports,
 * with the real SDK in between (shared contracts §1.1). Provides `Hosting` and
 * `FakeHostHandle`; both are disposed when the scope closes.
 */
export function HostingTest(
  options: HostingTestOptions = {},
): Layer.Layer<Hosting | FakeHostHandle, HostError> {
  return Layer.scopedContext(
    Effect.gen(function* () {
      const gameOptions: HostingOptions = {
        gameId: 'blank-game',
        wants: ['saves'],
        pauseBehavior: 'pause',
        ...options.hosting,
      }
      const host = yield* Effect.acquireRelease(
        Effect.sync(() =>
          createFakeHost({
            gameOrigin: options.gameOrigin ?? TEST_GAME_ORIGIN,
            gameId: gameOptions.gameId,
            clock: realClock,
            ...options.host,
          }),
        ),
        (opened) => Effect.sync(() => opened.dispose()),
      )
      if (host.gameEnv === null) return yield* Effect.dieMessage('HostingTest needs the in-memory fake host')
      const env = options.env === undefined ? host.gameEnv : options.env(host.gameEnv)
      const hosting = yield* makeHosting(gameOptions, { env })
      const handle: FakeHostHandle = {
        host,
        sentByGame: (type) =>
          host.messages
            .filter((entry) => entry.dir === 'in' && entry.msg.type === type)
            .map((entry) => entry.msg.payload),
      }
      return Context.make(Hosting, hosting).pipe(Context.add(FakeHostHandle, handle))
    }),
  )
}
