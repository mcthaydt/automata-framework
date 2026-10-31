import { HOST_EXIT_CAP, Hosting, type HostingOptions } from '@mcthaydt/automata-host'
import { Duration, Effect, Either, Exit, Fiber, Layer, Scope, Stream, TestClock, TestContext } from 'effect'
import { describe, expect, it } from 'vitest'
import { FakeHostControl, FakeHosting, type FakeHostingOptions } from './index'

const GAME: HostingOptions = { gameId: 'fake-game', wants: ['saves'], pauseBehavior: 'pause' }

/** Runs `program` against a fresh fake host, in a scope that closes at the end. */
function withFake<A>(
  options: FakeHostingOptions,
  program: (hosting: Hosting, control: FakeHostControl) => Effect.Effect<A, unknown, Scope.Scope>,
  game: HostingOptions = GAME,
): Promise<A> {
  return Effect.runPromise(
    Effect.scoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        const control = yield* FakeHostControl
        return yield* program(hosting, control)
      }).pipe(Effect.provide(Layer.fresh(FakeHosting(options, game)))),
    ),
  )
}

const failure = <A, E>(effect: Effect.Effect<A, E>) => Effect.flip(effect)

describe('FakeHosting: what each target grants and names (DIST spec §4.3)', () => {
  it.each([
    ['web', 'web', 'this page', ['audio', 'display', 'input', 'lifecycle', 'saves']],
    ['itch', 'web', 'itch.io', ['audio', 'display', 'input', 'lifecycle', 'saves']],
    ['tauri', 'tauri', 'Cinder', ['audio', 'display', 'exit', 'input', 'lifecycle', 'saves']],
    ['ruken', 'ruken', 'Ruken', ['audio', 'display', 'input', 'leaderboards', 'lifecycle', 'saves']],
  ] as const)('the %s target is kind %s, named "%s", and grants %j', (target, kind, hostName, granted) =>
    withFake(
      { target, title: 'Cinder' },
      (hosting) =>
        Effect.sync(() => {
          expect(hosting.kind).toBe(kind)
          expect(hosting.hostName).toBe(hostName)
          expect([...hosting.granted].sort()).toEqual(granted)
        }),
      { ...GAME, wants: ['saves', 'leaderboards'] },
    ),
  )

  it.each([
    ['web', 'DENIED'],
    ['itch', 'DENIED'],
    ['tauri', 'DENIED'],
    ['ruken', 'UNSUPPORTED'],
  ] as const)('ungranted saves on %s fail %s and touch nothing (DIST-d)', (target, code) =>
    withFake({ target, granted: ['lifecycle'], saves: { progress: 'level-1' } }, (hosting, control) =>
      Effect.gen(function* () {
        for (const call of [
          hosting.saves.set('progress', 'level-2'),
          hosting.saves.get('progress'),
          hosting.saves.remove('progress'),
          hosting.saves.flush,
          hosting.saves.keys,
        ] as Effect.Effect<unknown, { code: string }>[]) {
          expect((yield* failure(call)).code).toBe(code)
        }
        expect([...control.saved]).toEqual([['progress', 'level-1']])
      }),
    ),
  )

  it.each([
    ['web', 'device'],
    ['itch', 'device'],
    ['tauri', 'device'],
    ['ruken', 'host-outbox'],
  ] as const)('a flush on %s says the saves went to %s', (target, persisted) =>
    withFake({ target }, (hosting) =>
      Effect.gen(function* () {
        expect(yield* hosting.saves.flush).toEqual({ persisted })
      }),
    ),
  )

  it('exit is granted on the desktop: it records the reason, runs the exiting handlers, then flushes', () =>
    withFake({ target: 'tauri' }, (hosting, control) =>
      Effect.gen(function* () {
        const ran: string[] = []
        yield* hosting.onExiting(Effect.sync(() => ran.push('handler')))
        control.hold('saves.flush')
        const exiting = yield* Effect.fork(hosting.exit('completed'))
        yield* Effect.promise(() => new Promise<void>((resolve) => setTimeout(resolve, 0)))
        // The handler has run and the exit now waits on the held flush.
        expect(ran).toEqual(['handler'])
        expect(exiting.unsafePoll()).toBeNull()
        control.release('saves.flush')
        yield* Fiber.join(exiting)
        expect(control.exits).toEqual(['completed'])
      }),
    ))

  it('exit fails UNSUPPORTED on the web, where there is nothing to go back to', () =>
    withFake({ target: 'web' }, (hosting, control) =>
      Effect.gen(function* () {
        expect(yield* failure(hosting.exit())).toMatchObject({
          code: 'UNSUPPORTED',
          operation: 'session.exit',
        })
        expect(control.exits).toEqual([])
      }),
    ))
})

describe('FakeHosting: analytics and consent (DIST spec §8 flow 4)', () => {
  const analytics: HostingOptions = { ...GAME, wants: ['analytics.custom'], disclosedEvents: ['level-up'] }

  it('records a disclosed event where the target grants analytics and the player consented', () =>
    withFake(
      { target: 'ruken' },
      (hosting, control) =>
        Effect.gen(function* () {
          yield* hosting.track('level-up', { level: 2 })
          yield* hosting.track('secret')
          expect(control.tracked).toEqual([{ event: 'level-up', props: { level: 2 } }])
        }),
      analytics,
    ))

  it('drops every event without consent, and on a target with no analytics', async () => {
    for (const options of [{ target: 'ruken', consent: false }, { target: 'web' }] as const) {
      await withFake(
        options,
        (hosting, control) =>
          Effect.gen(function* () {
            yield* hosting.track('level-up')
            expect(control.tracked).toEqual([])
          }),
        analytics,
      )
    }
  })
})

describe('FakeHosting: the control handle (DIST spec §7)', () => {
  it('holds ready until welcome() with deferReady', () =>
    withFake({ deferReady: true }, (hosting, control) =>
      Effect.gen(function* () {
        const ready = yield* Effect.fork(hosting.ready)
        yield* Effect.yieldNow()
        expect(ready.unsafePoll()).toBeNull()
        control.welcome()
        yield* Fiber.join(ready)
      }),
    ))

  it('fails ready with failReady(code)', () =>
    withFake({ deferReady: true }, (hosting, control) =>
      Effect.gen(function* () {
        control.failReady('TIMEOUT')
        expect(yield* failure(hosting.ready)).toMatchObject({ code: 'TIMEOUT', operation: 'ready' })
      }),
    ))

  it('delivers a pushed change and throws on a payload its schema refuses', () =>
    withFake({}, (hosting, control) =>
      Effect.gen(function* () {
        control.push.lifecycle({ state: 'background', reasons: ['hidden'] })
        expect(yield* hosting.lifecycle.get).toEqual({ state: 'background', reasons: ['hidden'] })
        expect(() => control.push.input({ mode: 'mouse' } as never)).toThrow(/push\.input/)
        expect(yield* hosting.input.get).toEqual({ mode: 'keyboard-mouse' })
      }),
    ))

  it("carries another device's write on saves.changed and into the host's saves", () =>
    withFake({}, (hosting, control) =>
      Effect.gen(function* () {
        const reader = yield* Effect.fork(Stream.runCollect(hosting.saves.changed.pipe(Stream.take(1))))
        yield* Effect.promise(() => new Promise<void>((resolve) => setTimeout(resolve, 0)))
        control.push.savesChanged({ key: 'slot', value: 'remote', revision: 2 })
        expect([...(yield* Fiber.join(reader))]).toEqual([{ key: 'slot', value: 'remote', revision: 2 }])
        expect(yield* hosting.saves.get('slot')).toBe('remote')
      }),
    ))

  it('fails the next call by name with failNext, then answers again', () =>
    withFake({}, (hosting, control) =>
      Effect.gen(function* () {
        control.failNext('saves.set', 'QUOTA_EXCEEDED')
        expect(yield* failure(hosting.saves.set('big', 'x'))).toMatchObject({ code: 'QUOTA_EXCEEDED' })
        expect(control.saved.has('big')).toBe(false)
        yield* hosting.saves.set('big', 'x')
        expect(control.saved.get('big')).toBe('x')
      }),
    ))

  it("holds a call so the caller's own timeout, on Effect's clock, fires", () =>
    withFake({}, (hosting, control) =>
      Effect.gen(function* () {
        control.hold('saves.flush')
        const flushing = yield* Effect.fork(
          Effect.either(hosting.saves.flush.pipe(Effect.timeout(Duration.seconds(5)))),
        )
        yield* TestClock.adjust(Duration.seconds(5))
        expect(Either.isLeft(yield* Fiber.join(flushing))).toBe(true)
      }).pipe(Effect.provide(TestContext.TestContext)),
    ))

  it('answers the menu with the latest handler, and false before ready or with none', () =>
    withFake({ deferReady: true }, (hosting, control) =>
      Effect.gen(function* () {
        yield* hosting.onMenuRequest(() => true)
        expect(control.requestMenu()).toBe(false)
        control.welcome()
        yield* hosting.ready
        expect(control.requestMenu()).toBe(true)
        const inner = yield* Scope.make()
        yield* hosting.onMenuRequest(() => false).pipe(Scope.extend(inner))
        expect(control.requestMenu()).toBe(false)
        yield* Scope.close(inner, Exit.void)
        expect(control.requestMenu()).toBe(true)
      }),
    ))

  it('close runs the exiting handlers in order, then the flush, and stops at HOST_EXIT_CAP', () =>
    withFake({}, (hosting, control) =>
      Effect.gen(function* () {
        const order: string[] = []
        yield* hosting.onExiting(Effect.sync(() => order.push('first')))
        yield* hosting.onExiting(Effect.sync(() => order.push('second')))
        yield* hosting.onExiting(Effect.never)
        yield* hosting.onExiting(Effect.sync(() => order.push('after the stuck one')))
        const closing = yield* Effect.fork(control.close)
        yield* TestClock.adjust(HOST_EXIT_CAP)
        yield* Fiber.join(closing)
        expect(order).toEqual(['first', 'second'])
      }).pipe(Effect.provide(TestContext.TestContext)),
    ))

  it('records fullscreen requests, rounds and leaderboard submissions', () =>
    withFake(
      { target: 'ruken' },
      (hosting, control) =>
        Effect.gen(function* () {
          yield* hosting.setFullscreen(true)
          expect(yield* hosting.display.get).toMatchObject({ fullscreen: true })
          yield* hosting.round.start
          yield* hosting.round.end('complete')
          yield* hosting.leaderboards.submit('high-score', 120, { level: 3 })
          expect(control.fullscreen).toEqual([true])
          expect(control.rounds).toEqual([{ start: true }, { end: 'complete' }])
          expect(control.submits).toEqual([{ board: 'high-score', score: 120, meta: { level: 3 } }])
        }),
      { ...GAME, wants: ['leaderboards'] },
    ))
})
