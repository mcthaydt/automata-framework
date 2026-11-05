import type { SdkEnv } from '@ruken/sdk'
import { createFakeHost, type FakeHost, type FakeHostOptions } from '@ruken/sdk-host/testing'
import { createRukenHosting } from '../../../../features/targets/ruken/hosting-ruken'
import type { HostResult } from '../../../../shared/host/errors'
import type { Hosting, HostingOptions } from '../../../../shared/host/hosting'
import type { Clock } from '../../../../shared/lib/clock'
import { realClock } from '../clocks'

/** The fake host behind `openHostingTest`, for tests that drive the host side. */
export interface FakeHostHandle {
  readonly host: FakeHost
  /** Every message of `type` the game sent the host, as payloads, in order. */
  sentByGame(type: string): unknown[]
}

/**
 * What to change about `openHostingTest`'s defaults: the game's hosting options, the fake host, the SDK
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

/** The origin `openHostingTest` serves the game from unless `gameOrigin` says otherwise. */
export const TEST_GAME_ORIGIN = 'http://localhost:4400'

/** `Hosting` over `@ruken/sdk-host`'s fake host, with the real SDK in between, and the handle that drives the host. */
export interface HostingTestSession {
  readonly hosting: Hosting
  readonly handle: FakeHostHandle
  /** Disposes `Hosting`, then the fake host. */
  dispose(): void
}

/**
 * Opens `Hosting` (plain) over the fake host, with the real SDK in between. `seams` reach the adapter: pass
 * `fakeClock()` as `clock` to move the exit cap by hand, or an `AbortSignal` to give up the handshake.
 */
export async function openHostingTest(
  options: HostingTestOptions = {},
  seams: { readonly clock?: Clock; readonly signal?: AbortSignal } = {},
): Promise<HostResult<HostingTestSession>> {
  const gameOptions: HostingOptions = {
    gameId: 'blank-game',
    wants: ['saves'],
    pauseBehavior: 'pause',
    ...options.hosting,
  }
  const host = createFakeHost({
    gameOrigin: options.gameOrigin ?? TEST_GAME_ORIGIN,
    gameId: gameOptions.gameId,
    clock: realClock,
    ...options.host,
  })
  if (host.gameEnv === null) {
    host.dispose()
    throw new Error('openHostingTest needs the in-memory fake host')
  }
  const env = options.env === undefined ? host.gameEnv : options.env(host.gameEnv)
  const made = await createRukenHosting(gameOptions, { env, ...seams })
  if (!made.ok) {
    host.dispose()
    return made
  }
  const handle: FakeHostHandle = {
    host,
    sentByGame: (type) =>
      host.messages
        .filter((entry) => entry.dir === 'in' && entry.msg.type === type)
        .map((entry) => entry.msg.payload),
  }
  return {
    ok: true,
    value: {
      hosting: made.value,
      handle,
      dispose: () => {
        made.value.dispose()
        host.dispose()
      },
    },
  }
}

/** Runs `program` on an open session and always disposes it. A construction refusal throws, so a test fails loudly. */
export async function withHostingTest<A>(
  program: (session: HostingTestSession) => Promise<A> | A,
  options: HostingTestOptions = {},
  seams: { readonly clock?: Clock; readonly signal?: AbortSignal } = {},
): Promise<A> {
  const opened = await openHostingTest(options, seams)
  if (!opened.ok) throw new Error(`Hosting was refused: ${opened.reason.code} on ${opened.reason.operation}`)
  try {
    return await program(opened.value)
  } finally {
    opened.value.dispose()
  }
}
