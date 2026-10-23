import type { SdkEnv, SdkMessagePort } from '@ruken/sdk'
import { settle } from '@ruken/sdk-host/testing'
import {
  Chunk,
  Context,
  Duration,
  Effect,
  Either,
  Exit,
  Fiber,
  Layer,
  Logger,
  Scope,
  Stream,
  TestClock,
  TestContext,
} from 'effect'
import { describe, expect, it } from 'vitest'
import { Hosting } from './hosting'
import { HOST_EXIT_CAP } from './hosting-live'
import { FakeHostHandle, HostingTest, type HostingTestOptions, manualClock, runScoped } from './testing'

const settled: Effect.Effect<void> = Effect.promise(() => settle())

/** Builds `HostingTest` in its own scope, so a test can shut Hosting down part-way. */
const openHosting = (options: HostingTestOptions = {}) =>
  Effect.gen(function* () {
    const scope = yield* Scope.make()
    const context = yield* Layer.buildWithScope(HostingTest(options), scope)
    return { hosting: Context.get(context, Hosting), handle: Context.get(context, FakeHostHandle), scope }
  })

describe('shutting Hosting down (audit of PR #5)', () => {
  it('ends every observed stream when Hosting shuts down', async () => {
    await runScoped(
      Effect.gen(function* () {
        const { hosting, scope } = yield* openHosting()
        const streams = [
          hosting.lifecycle,
          hosting.input,
          hosting.display,
          hosting.audio,
          hosting.entitlements,
          hosting.savesStatus,
        ].map((observed) => observed.changes as Stream.Stream<unknown>)
        const readers = yield* Effect.forEach(streams, (changes) => Effect.fork(Stream.runCollect(changes)))
        yield* settled
        yield* Scope.close(scope, Exit.void)
        const collected = yield* Effect.forEach(readers, Fiber.join)
        // Each stream gave its current value, then ended.
        expect(collected.map(Chunk.size)).toEqual([1, 1, 1, 1, 1, 1])
      }),
    )
  })

  it('ends the saves changed stream when Hosting shuts down (M5 spec §4.1)', async () => {
    await runScoped(
      Effect.gen(function* () {
        const { hosting, scope } = yield* openHosting()
        const reader = yield* Effect.fork(Stream.runCollect(hosting.saves.changed))
        yield* settled
        yield* Scope.close(scope, Exit.void)
        // No other device wrote: the stream ends empty.
        expect(Chunk.size(yield* Fiber.join(reader))).toBe(0)
      }),
    )
  })

  it('fails saves and requests on a shut-down Hosting with a typed HostError instead of dropping them', async () => {
    await runScoped(
      Effect.gen(function* () {
        const { hosting, handle, scope } = yield* openHosting()
        yield* Scope.close(scope, Exit.void)
        for (const attempt of [
          hosting.saves.set('progress', '2'),
          hosting.saves.get('progress'),
          hosting.saves.remove('progress'),
          hosting.saves.flush,
          hosting.saves.keys,
          hosting.setFullscreen(true),
          hosting.exit(),
        ] as Effect.Effect<unknown, unknown>[]) {
          const result = yield* Effect.either(attempt)
          expect(Either.isLeft(result) && result.left).toMatchObject({ _tag: 'HostError', code: 'CANCELLED' })
        }
        expect(handle.sentByGame('saves.set')).toEqual([])
      }),
    )
  })
})

describe('the built-in save flush on exit (FloorFifty ruken/exit.ts)', () => {
  it('flushes pending saves before the game tells the host it is ready to close, with no handler registered', async () => {
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host } = yield* FakeHostHandle
        yield* hosting.saves.set('progress', '2')
        yield* Effect.promise(() => host.bridge.exit())
        const sent = host.messages.filter((entry) => entry.dir === 'in').map((entry) => entry.msg.type)
        expect(sent.indexOf('saves.flush')).toBeGreaterThan(-1)
        expect(sent.indexOf('session.exitReady')).toBeGreaterThan(sent.indexOf('saves.flush'))
      }).pipe(Effect.provide(HostingTest())),
    )
  })

  it('stops waiting for a flush the host never answers after HOST_EXIT_CAP', async () => {
    const clock = manualClock()
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host, sentByGame } = yield* FakeHostHandle
        yield* hosting.saves.set('progress', '2')
        const closing = yield* Effect.fork(Effect.promise(() => host.bridge.exit()))
        yield* settled
        expect(sentByGame('session.exitReady')).toEqual([])
        yield* TestClock.adjust(HOST_EXIT_CAP)
        yield* settled
        expect(sentByGame('session.exitReady')).toHaveLength(1)
        clock.advance(10_000)
        yield* Fiber.join(closing)
      }).pipe(
        Effect.provide(HostingTest({ host: { clock }, env: swallowGameMessages('saves.flush') })),
        Effect.provide(TestContext.TestContext),
      ),
    )
  })
})

/**
 * The SDK runs its `exiting` listeners together, so a game's last write and the
 * host flush would race: the flush can leave before the write reaches the SDK's
 * outbox. Hosting orders them (M5.2 plan step 2): the game's handlers one after
 * another in registration order, then the flush, inside one HOST_EXIT_CAP.
 */
describe('the order of exit handlers and the flush (M5.2)', () => {
  const sleep = (millis: number): Effect.Effect<void> => Effect.sleep(Duration.millis(millis))

  /** Closes the game and lets `millis` of Effect time pass inside the exit, so a sleeping handler can finish. */
  const closeAfter = (host: FakeHostHandle['host'], clock: ReturnType<typeof manualClock>, millis: number) =>
    Effect.gen(function* () {
      const closing = yield* Effect.fork(Effect.promise(() => host.bridge.exit()))
      yield* settled
      yield* TestClock.adjust(Duration.millis(millis))
      yield* settled
      clock.advance(10_000)
      yield* Fiber.join(closing)
    })

  it('waits for a handler that writes late, then flushes, then tells the host it is ready', async () => {
    const clock = manualClock()
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host, sentByGame } = yield* FakeHostHandle
        yield* hosting.onExiting(
          sleep(100).pipe(Effect.zipRight(Effect.ignore(hosting.saves.set('late', '1')))),
        )
        yield* closeAfter(host, clock, 100)
        const order = host.messages
          .filter((entry) => entry.dir === 'in')
          .map((entry) => entry.msg.type)
          .filter((type) => ['saves.set', 'saves.flush', 'session.exitReady'].includes(type))
        expect(order).toEqual(['saves.set', 'saves.flush', 'session.exitReady'])
        expect(sentByGame('saves.flush')).toHaveLength(1)
      }).pipe(Effect.provide(HostingTest({ host: { clock } })), Effect.provide(TestContext.TestContext)),
    )
  })

  it('runs handlers one after another, in the order they were registered', async () => {
    const clock = manualClock()
    const ran: string[] = []
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host } = yield* FakeHostHandle
        yield* hosting.onExiting(sleep(50).pipe(Effect.zipRight(Effect.sync(() => ran.push('first')))))
        yield* hosting.onExiting(Effect.sync(() => ran.push('second')))
        yield* closeAfter(host, clock, 50)
        expect(ran).toEqual(['first', 'second'])
      }).pipe(Effect.provide(HostingTest({ host: { clock } })), Effect.provide(TestContext.TestContext)),
    )
  })

  it('skips a handler whose scope closed, and carries on past one that fails', async () => {
    const clock = manualClock()
    const ran: string[] = []
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host, sentByGame } = yield* FakeHostHandle
        const gone = yield* Scope.make()
        yield* hosting.onExiting(Effect.sync(() => ran.push('first')))
        yield* hosting.onExiting(Effect.sync(() => ran.push('gone'))).pipe(Scope.extend(gone))
        yield* hosting.onExiting(Effect.die('a handler broke'))
        yield* hosting.onExiting(Effect.sync(() => ran.push('last')))
        yield* Scope.close(gone, Exit.void)
        yield* closeAfter(host, clock, 0)
        expect(ran).toEqual(['first', 'last'])
        expect(sentByGame('saves.flush')).toHaveLength(1)
      }).pipe(Effect.provide(HostingTest({ host: { clock } })), Effect.provide(TestContext.TestContext)),
    )
  })

  it('answers the host at HOST_EXIT_CAP when a handler never returns, and the flush is skipped', async () => {
    const clock = manualClock()
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const { host, sentByGame } = yield* FakeHostHandle
        yield* hosting.saves.set('progress', '2')
        yield* hosting.onExiting(Effect.never)
        const closing = yield* Effect.fork(Effect.promise(() => host.bridge.exit()))
        yield* settled
        expect(sentByGame('session.exitReady')).toEqual([])
        yield* TestClock.adjust(HOST_EXIT_CAP)
        yield* settled
        expect(sentByGame('session.exitReady')).toHaveLength(1)
        expect(sentByGame('saves.flush')).toEqual([])
        clock.advance(10_000)
        yield* Fiber.join(closing)
      }).pipe(Effect.provide(HostingTest({ host: { clock } })), Effect.provide(TestContext.TestContext)),
    )
  })
})

describe('lower-severity audit items', () => {
  it('warns when track() drops an event', async () => {
    const warnings: unknown[] = []
    const collect = Logger.make(({ logLevel, message }) => {
      if (logLevel._tag === 'Warning') warnings.push(message)
    })
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        yield* hosting.track('not_disclosed')
        expect(warnings.flat().join(' ')).toContain('not_disclosed')
      }).pipe(
        Effect.provide(
          HostingTest({ hosting: { wants: ['analytics.custom'], disclosedEvents: ['race_started'] } }),
        ),
        Effect.provide(Logger.replace(Logger.defaultLogger, collect)),
      ),
    )
  })

  it('can be interrupted during the handshake, and disposes the session that arrives late', async () => {
    const clock = manualClock()
    await runScoped(
      Effect.gen(function* () {
        let disposed = 0
        const building = yield* Effect.fork(
          Hosting.pipe(
            Effect.provide(
              HostingTest({
                host: { clock },
                // Hold the welcome until after the interrupt, and count port closes (session.dispose).
                env: delayWelcomeAndCountCloses(() => (disposed += 1)),
              }),
            ),
          ),
        )
        yield* settled
        yield* Fiber.interrupt(building)
        releaseHeldWelcome()
        yield* settled
        expect(disposed).toBe(1)
      }),
    )
  })

  it('fails with a typed HostError, not a crash, when the host options are invalid', async () => {
    const result = await runScoped(
      Effect.either(
        Hosting.pipe(
          Effect.provide(HostingTest({ hosting: { testHostOrigins: ['http://not-https.test'] } })),
        ),
      ),
    )
    expect(Either.isLeft(result) && result.left).toMatchObject({ _tag: 'HostError', operation: 'init' })
  })
})

/** Drops the game's outgoing protocol messages of `type`, as a host that never answers them. */
function swallowGameMessages(type: string) {
  const wrap = (port: SdkMessagePort): SdkMessagePort => ({
    ...port,
    postMessage: (message) => {
      if ((message as { type?: string }).type === type) return
      port.postMessage(message)
    },
    addEventListener: (kind, fn) => port.addEventListener(kind, fn),
    removeEventListener: (kind, fn) => port.removeEventListener(kind, fn),
    start: () => port.start(),
    close: () => port.close(),
  })
  return (env: SdkEnv): SdkEnv => ({
    ...env,
    onWindowMessage: (fn) => env.onWindowMessage((event) => fn({ ...event, ports: event.ports.map(wrap) })),
  })
}

let heldWelcome: (() => void) | undefined
function releaseHeldWelcome(): void {
  heldWelcome?.()
}
function delayWelcomeAndCountCloses(onClose: () => void) {
  const wrap = (port: SdkMessagePort): SdkMessagePort => ({
    postMessage: (message) => port.postMessage(message),
    addEventListener: (kind, fn) => port.addEventListener(kind, fn),
    removeEventListener: (kind, fn) => port.removeEventListener(kind, fn),
    start: () => port.start(),
    close: () => {
      onClose()
      port.close()
    },
  })
  return (env: SdkEnv): SdkEnv => ({
    ...env,
    onWindowMessage: (fn) =>
      env.onWindowMessage((event) => {
        if ((event.data as { type?: string }).type !== 'welcome') return fn(event)
        heldWelcome = () => fn({ ...event, ports: event.ports.map(wrap) })
      }),
  })
}
