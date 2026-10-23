import type { SdkEnv, SdkMessagePort } from '@ruken/sdk'
import { settle } from '@ruken/sdk-host/testing'
import { Chunk, Effect, Exit, Fiber, Scope, Stream, TestClock, TestContext } from 'effect'
import { describe, expect, it } from 'vitest'
import { Hosting } from './hosting'
import { HOST_EXIT_CAP } from './hosting-live'
import { FakeHostHandle, HostingTest, manualClock, runScoped } from './testing'

const settled: Effect.Effect<void> = Effect.promise(() => settle())

const sentToGame = (host: FakeHostHandle['host'], type: string): unknown[] =>
  host.messages.filter((entry) => entry.dir === 'out' && entry.msg.type === type)

describe("the host's Open game menu (FloorFifty menu-request; S6 answer 6)", () => {
  // The host sends menu.open only to a game that asked for the `menu` capability.
  const menuHost = (autoReady = true) => HostingTest({ hosting: { wants: ['menu'] }, host: { autoReady } })

  it('is refused until a handler says yes, and again once its scope closes', async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host } = yield* FakeHostHandle
        expect(yield* Effect.promise(() => host.bridge.openGameMenu())).toBe(false)
        expect(sentToGame(host, 'menu.open')).toHaveLength(1)

        const screen = yield* Scope.make()
        yield* hosting.onMenuRequest(() => true).pipe(Scope.extend(screen))
        expect(yield* Effect.promise(() => host.bridge.openGameMenu())).toBe(true)

        yield* Scope.close(screen, Exit.void)
        expect(yield* Effect.promise(() => host.bridge.openGameMenu())).toBe(false)
      }).pipe(Effect.provide(menuHost())),
    )
  })

  it('is answered by the latest handler', async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host } = yield* FakeHostHandle
        yield* hosting.onMenuRequest(() => true)
        yield* hosting.onMenuRequest(() => false)
        expect(yield* Effect.promise(() => host.bridge.openGameMenu())).toBe(false)
      }).pipe(Effect.provide(menuHost())),
    )
  })

  it('before session.ready, a menu.open never reaches the handler and is refused', async () => {
    // Ruken's answer 6 says the SDK answers NOT_READY here, but the SDK at b30d31b has no
    // such check (only the host-side bridge refuses to send menu.open before ready), so
    // AF's dispatcher holds handlers back until ready (coordinator decision, 2026-10-11).
    // The fake host never sends menu.open before ready, so the test puts one on the game's port.
    const injected = interceptGamePort()
    let asked = 0
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host } = yield* FakeHostHandle
        yield* hosting.onMenuRequest(() => {
          asked += 1
          return true
        })
        injected.send({ ruken: 1, id: 'early-menu', kind: 'req', type: 'menu.open', payload: {} })
        yield* settled
        expect(injected.answered('early-menu')).toMatchObject({ kind: 'res', payload: { opened: false } })
        expect(asked).toBe(0)

        // Once the host says ready, the same handler answers.
        yield* Effect.promise(() => host.bridge.markReady())
        yield* settled
        injected.send({ ruken: 1, id: 'menu-after-ready', kind: 'req', type: 'menu.open', payload: {} })
        yield* settled
        expect(injected.answered('menu-after-ready')).toMatchObject({ payload: { opened: true } })
        expect(asked).toBe(1)
      }).pipe(
        Effect.provide(
          HostingTest({ hosting: { wants: ['menu'] }, host: { autoReady: false }, env: injected.env }),
        ),
      ),
    )
  })
})

/**
 * Wraps the game's SdkEnv so a test can put its own messages on the game's
 * MessagePort (as if the host sent them) and read the game's answers.
 */
function interceptGamePort() {
  let listeners: ((event: { data: unknown }) => void)[] = []
  const posted: unknown[] = []
  const wrapPort = (port: SdkMessagePort): SdkMessagePort => ({
    postMessage: (message) => {
      posted.push(message)
      port.postMessage(message)
    },
    addEventListener: (type, fn) => {
      listeners.push(fn)
      port.addEventListener(type, fn)
    },
    removeEventListener: (type, fn) => {
      listeners = listeners.filter((listener) => listener !== fn)
      port.removeEventListener(type, fn)
    },
    start: () => port.start(),
    close: () => port.close(),
  })
  return {
    env: (env: SdkEnv): SdkEnv => ({
      ...env,
      onWindowMessage: (fn) =>
        env.onWindowMessage((event) => fn({ ...event, ports: event.ports.map(wrapPort) })),
    }),
    send: (data: unknown) => {
      for (const listener of listeners) listener({ data })
    },
    answered: (id: string) => posted.find((message) => (message as { re?: string }).re === id),
  }
}

describe('the host closing the game (FloorFifty exit-and-links)', () => {
  it('runs the exiting handler before the game tells the host it is ready to go', async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host, sentByGame } = yield* FakeHostHandle
        yield* hosting.saves.set('progress', '2')
        yield* hosting.onExiting(Effect.asVoid(hosting.saves.flush.pipe(Effect.ignore)))
        yield* Effect.promise(() => host.bridge.exit())
        const sent = host.messages.filter((entry) => entry.dir === 'in').map((entry) => entry.msg.type)
        expect(sent.indexOf('saves.flush')).toBeGreaterThan(-1)
        expect(sent.indexOf('session.exitReady')).toBeGreaterThan(sent.indexOf('saves.flush'))
        expect(sentByGame('session.exitReady')).toHaveLength(1)
      }).pipe(Effect.provide(HostingTest())),
    )
  })

  it('cuts a handler that never finishes at HOST_EXIT_CAP, on Effect time', async () => {
    const clock = manualClock()
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host, sentByGame } = yield* FakeHostHandle
        yield* hosting.onExiting(Effect.never)
        const closing = yield* Effect.fork(Effect.promise(() => host.bridge.exit()))
        yield* settled
        expect(sentByGame('session.exitReady')).toEqual([])

        yield* TestClock.adjust(HOST_EXIT_CAP)
        yield* settled
        expect(sentByGame('session.exitReady')).toHaveLength(1)
        clock.advance(2_000)
        yield* Fiber.join(closing)
      }).pipe(Effect.provide(HostingTest({ host: { clock } })), Effect.provide(TestContext.TestContext)),
    )
  })

  it('stops calling a handler once its scope closes', async () => {
    let ran = 0
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host } = yield* FakeHostHandle
        const screen = yield* Scope.make()
        yield* hosting.onExiting(Effect.sync(() => (ran += 1))).pipe(Scope.extend(screen))
        yield* Scope.close(screen, Exit.void)
        yield* Effect.promise(() => host.bridge.exit())
        expect(ran).toBe(0)
      }).pipe(Effect.provide(HostingTest())),
    )
  })
})

describe('requests', () => {
  it("exit hands the player back to the host, with the reason 'player' by default", async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { sentByGame } = yield* FakeHostHandle
        yield* Effect.fork(hosting.exit())
        yield* settled
        yield* Effect.fork(hosting.exit('completed'))
        yield* settled
        expect(sentByGame('session.exit')).toEqual([{ reason: 'player' }, { reason: 'completed' }])
      }).pipe(Effect.provide(HostingTest())),
    )
  })

  it("asks the host for fullscreen and returns Ruken's answer, including support (FloorFifty fullscreen-hosted)", async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host } = yield* FakeHostHandle
        const asked = yield* Effect.fork(hosting.setFullscreen(true))
        yield* settled
        expect(yield* Fiber.join(asked)).toEqual({ fullscreen: false, support: 'ios-home-screen' })
        expect(host.ui.callsTo('requestFullscreen')).toEqual([[true]])
      }).pipe(
        Effect.provide(
          HostingTest({
            host: {
              ui: { requestFullscreen: async () => ({ fullscreen: false, support: 'ios-home-screen' }) },
            },
          }),
        ),
      ),
    )
  })

  it('sends one round start per round, and an end only for an open round (FloorFifty rounds)', async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { sentByGame } = yield* FakeHostHandle
        yield* hosting.round.end('quit')
        yield* hosting.round.start
        yield* hosting.round.start
        yield* hosting.round.end('complete')
        yield* hosting.round.end('quit')
        yield* settled
        expect(sentByGame('telemetry.round')).toEqual([
          { kind: 'start' },
          { kind: 'end', outcome: 'complete' },
        ])
      }).pipe(Effect.provide(HostingTest())),
    )
  })
})

describe('round ends as an observable (M5.2 plan step 3)', () => {
  it('gives one item per round that ended, with its outcome, and none for a dropped end', async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const reader = yield* Effect.fork(
          Stream.runCollect(hosting.round.ended.pipe(Stream.take(2))).pipe(Effect.map(Chunk.toReadonlyArray)),
        )
        yield* settled
        yield* hosting.round.end('quit') // no round open: dropped
        yield* hosting.round.start
        yield* hosting.round.start // second start: dropped
        yield* hosting.round.end('complete')
        yield* hosting.round.end('quit') // already ended: dropped
        yield* hosting.round.start
        yield* hosting.round.end()
        expect(yield* Fiber.join(reader)).toEqual(['complete', undefined])
      }).pipe(Effect.provide(HostingTest())),
    )
  })
})

describe('analytics (FloorFifty analytics)', () => {
  const analyticsHost = (consent: boolean) =>
    HostingTest({
      hosting: { wants: ['analytics.custom'], disclosedEvents: ['race_started', 'tutorial_completed'] },
      host: { consent: { analytics: consent } },
    })

  it('sends a disclosed event with its props when the player consented', async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { sentByGame } = yield* FakeHostHandle
        yield* hosting.track('race_started', { mode: 'quick' })
        yield* hosting.track('tutorial_completed')
        yield* settled
        expect(sentByGame('analytics.track')).toEqual([
          { name: 'race_started', props: { mode: 'quick' } },
          { name: 'tutorial_completed' },
        ])
      }).pipe(Effect.provide(analyticsHost(true))),
    )
  })

  it('sends nothing without consent', async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { sentByGame } = yield* FakeHostHandle
        yield* hosting.track('race_started', { mode: 'quick' })
        yield* settled
        expect(sentByGame('analytics.track')).toEqual([])
      }).pipe(Effect.provide(analyticsHost(false))),
    )
  })

  it('drops an event that is not disclosed, and never fails on one the SDK refuses', async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { sentByGame } = yield* FakeHostHandle
        yield* hosting.track('secret_event')
        yield* hosting.track('race_started', { nested: { no: true } } as never)
        yield* settled
        expect(sentByGame('analytics.track')).toEqual([])
      }).pipe(Effect.provide(analyticsHost(true))),
    )
  })
})
