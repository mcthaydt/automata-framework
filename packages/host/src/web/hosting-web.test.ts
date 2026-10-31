import {
  Effect,
  Either,
  Exit,
  Fiber,
  Layer,
  Logger,
  Option,
  type Scope,
  Stream,
  type Subscribable,
  TestClock,
  TestContext,
} from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { Hosting, type HostingOptions } from '../contract/hosting'
import { describeHostingContract } from '../contract-suite'
import { runScoped } from '../testing'
import { type FakeWebPage, type FakeWebPageOptions, fakeWebPage } from '../testing/fake-web-page'
import { buildTarget, makeWebHosting, WEB_STORAGE_PROBE_KEY, type WebTarget } from './hosting-web'

const OPTIONS: HostingOptions = { gameId: 'blank-game', wants: ['saves'], pauseBehavior: 'pause' }

/** The web adapter over a fake page, as a layer; the page is returned so a test can drive it. */
function webHosting(pageOptions: FakeWebPageOptions = {}, target: WebTarget = 'web', hosting = OPTIONS) {
  const fake: FakeWebPage = fakeWebPage(pageOptions)
  return { fake, layer: Layer.scoped(Hosting, makeWebHosting(hosting, fake.page, target)) }
}

/** Lets forked stream readers take what the page has emitted so far (one macrotask). */
const delivered: Effect.Effect<void> = Effect.promise(
  () => new Promise<void>((resolve) => setTimeout(resolve, 0)),
)

// PUB-a and DIST-c: the contract cases every adapter passes (the Ruken adapter's run is in
// `ruken/hosting-ruken.contract.test.ts`).
describeHostingContract('the web adapter over a page', () => webHosting().layer, delivered)

/** Runs `program` against the web adapter over a fresh fake page. */
function onWebPage<A>(
  program: (hosting: Hosting, fake: FakeWebPage) => Effect.Effect<A, unknown, Scope.Scope>,
  pageOptions: FakeWebPageOptions = {},
  target: WebTarget = 'web',
) {
  const { fake, layer } = webHosting(pageOptions, target)
  return runScoped(Effect.flatMap(Hosting, (hosting) => program(hosting, fake)).pipe(Effect.provide(layer)))
}

/**
 * Collects every value `observed` gives (the current one first) until the test's scope closes. `step` runs
 * page events one at a time, each delivered before the next, so the test sees each change on its own.
 */
const record = <A>(observed: Subscribable.Subscribable<A>) =>
  Effect.gen(function* () {
    const values: A[] = []
    yield* Effect.forkScoped(
      Stream.runForEach(observed.changes, (value) => Effect.sync(() => values.push(value))),
    )
    yield* delivered
    const step = (...events: (() => void)[]) =>
      Effect.forEach(events, (event) => Effect.zipRight(Effect.sync(event), delivered), { discard: true })
    return { values, step }
  })

describe('the web adapter: what a page outside Ruken can observe (PUB spec §3.1)', () => {
  it('names itch.io for an itch build and "this page" for a web build', async () => {
    expect(await onWebPage((hosting) => Effect.succeed(hosting.hostName), {}, 'itch')).toBe('itch.io')
    expect(await onWebPage((hosting) => Effect.succeed(hosting.hostName), {}, 'web')).toBe('this page')
    expect(await onWebPage((hosting) => Effect.succeed(hosting.kind))).toBe('web')
  })

  it("reads the browser's language, else en, and the SDK's standalone player", async () => {
    expect(await onWebPage((hosting) => Effect.succeed(hosting.locale), { language: 'fr-CA' })).toBe('fr-CA')
    expect(await onWebPage((hosting) => Effect.succeed(hosting.locale))).toBe('en')
    expect(await onWebPage((hosting) => Effect.succeed(hosting.player))).toEqual({
      id: 'standalone',
      displayName: '',
    })
  })

  it('grants lifecycle, input, display, audio and saves, and nothing it cannot do', async () => {
    const granted = await onWebPage((hosting) => Effect.succeed([...hosting.granted].sort()))
    expect(granted).toEqual(['audio', 'display', 'input', 'lifecycle', 'saves'])
  })

  it('lifecycle goes to background when the tab is hidden or the page loses focus, with reasons', () =>
    onWebPage((hosting, fake) =>
      Effect.gen(function* () {
        const { values, step } = yield* record(hosting.lifecycle)
        yield* step(
          () => fake.setVisibility('hidden'),
          () => fake.setFocus(false),
          () => fake.setVisibility('visible'),
          () => fake.setFocus(true),
        )
        expect(values).toEqual([
          { state: 'active', reasons: [] },
          { state: 'background', reasons: ['hidden'] },
          { state: 'background', reasons: ['hidden', 'blurred'] },
          { state: 'background', reasons: ['blurred'] },
          { state: 'active', reasons: [] },
        ])
        expect(yield* hosting.lifecycle.get).toEqual({ state: 'active', reasons: [] })
      }),
    ))

  it('input mode follows real pointer, touch, keyboard and gamepad events', () =>
    onWebPage((hosting, fake) =>
      Effect.gen(function* () {
        const { values, step } = yield* record(hosting.input)
        yield* step(
          () => fake.dispatch('pointerdown', { pointerType: 'touch' }),
          // Still touch: no change is reported.
          () => fake.dispatch('touchstart'),
          () => fake.dispatch('keydown'),
          () =>
            fake.dispatch('gamepadconnected', {
              gamepad: { id: 'Xbox Wireless Controller (STANDARD GAMEPAD)' },
            }),
          () => fake.dispatch('pointerdown', { pointerType: 'mouse' }),
          () => fake.dispatch('gamepaddisconnected', { gamepad: { id: 'Xbox Wireless Controller' } }),
        )
        expect(values).toEqual([
          { mode: 'keyboard-mouse' },
          { mode: 'touch' },
          { mode: 'keyboard-mouse' },
          { mode: 'gamepad', gamepad: { layout: 'xbox', connected: true } },
          { mode: 'keyboard-mouse', gamepad: { layout: 'xbox', connected: true } },
          { mode: 'keyboard-mouse', gamepad: { layout: 'xbox', connected: false } },
        ])
      }),
    ))

  it('starts in touch mode on a coarse pointer (a phone)', async () => {
    const input = await onWebPage((hosting) => hosting.input.get, { coarsePointer: true })
    expect(input).toEqual({ mode: 'touch' })
  })

  it("display follows the visual viewport's orientation", () =>
    onWebPage(
      (hosting, fake) =>
        Effect.gen(function* () {
          const { values, step } = yield* record(hosting.display)
          yield* step(
            () => fake.resize(390, 844),
            // Still portrait (a browser bar or keyboard): no change is reported.
            () => fake.resize(390, 700),
            () => fake.resize(844, 390),
          )
          expect(values.map((metrics) => metrics.orientation)).toEqual(['landscape', 'portrait', 'landscape'])
          expect(values[0]?.hostReserved.rect).toEqual({ x: 0, y: 0, w: 0, h: 0 })
        }),
      { width: 1280, height: 720 },
    ))

  it('setFullscreen uses the Element Fullscreen API and display reports it', () =>
    onWebPage((hosting) =>
      Effect.gen(function* () {
        expect(yield* hosting.setFullscreen(true)).toEqual({ fullscreen: true, support: 'element' })
        expect((yield* hosting.display.get).fullscreen).toBe(true)
        expect(yield* hosting.setFullscreen(false)).toEqual({ fullscreen: false, support: 'element' })
        expect((yield* hosting.display.get).fullscreen).toBe(false)
      }),
    ))

  it("setFullscreen reports support 'none' where the browser allows no element fullscreen", async () => {
    const result = await onWebPage((hosting) => hosting.setFullscreen(true), { fullscreenEnabled: false })
    expect(result).toEqual({ fullscreen: false, support: 'none' })
  })

  it('setFullscreen fails DENIED when the browser refuses the request', async () => {
    const result = await onWebPage((hosting) => Effect.either(hosting.setFullscreen(true)), {
      fullscreenRequest: 'refuse',
    })
    expect(Either.isLeft(result) && result.left).toMatchObject({
      _tag: 'HostError',
      code: 'DENIED',
      operation: 'display.fullscreen',
    })
  })

  it("keeps saves in localStorage under the SDK's ruken:<gameId>: prefix, beside other games' keys", () =>
    onWebPage((hosting, fake) =>
      Effect.gen(function* () {
        fake.stored.set('ruken:other-game:progress', '9')
        yield* hosting.saves.set('progress', '2')
        expect(fake.stored.get('ruken:blank-game:progress')).toBe('2')
        expect(fake.stored.get('ruken:other-game:progress')).toBe('9')
      }),
    ))

  it("lists only this game's keys, without the prefix, the probe's key or another game's keys", () =>
    onWebPage((hosting, fake) =>
      Effect.gen(function* () {
        fake.stored.set('ruken:other-game:progress', '9')
        fake.stored.set('theme', 'dark')
        yield* hosting.saves.set('b', '1')
        yield* hosting.saves.set('a', '2')
        expect(yield* hosting.saves.keys).toEqual(['a', 'b'])
      }),
    ))

  it('never reports a change to saves: one browser, one writer (Ruken: another device)', () =>
    onWebPage((hosting, fake) =>
      Effect.gen(function* () {
        const changes = yield* Effect.fork(Stream.runCollect(hosting.saves.changed))
        yield* delivered
        fake.stored.set('ruken:blank-game:progress', '9') // a write from outside this session
        yield* hosting.saves.set('progress', '4')
        yield* delivered
        expect(yield* Fiber.poll(changes)).toEqual(Option.none())
      }),
    ))

  it("probes storage with its own key, never the SDK's ruken:__probe__", () =>
    onWebPage((_hosting, fake) =>
      Effect.sync(() => {
        expect(fake.writes).toEqual([WEB_STORAGE_PROBE_KEY])
        expect(WEB_STORAGE_PROBE_KEY).not.toBe('ruken:__probe__')
        expect(fake.stored.size).toBe(0)
      }),
    ))

  it('warns when track() drops an undisclosed event, as the Ruken adapter does', async () => {
    const warnings: unknown[] = []
    const collect = Logger.make(({ logLevel, message }) => {
      if (logLevel._tag === 'Warning') warnings.push(message)
    })
    const { layer } = webHosting({}, 'web', { ...OPTIONS, disclosedEvents: ['race_started'] })
    await runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        yield* hosting.track('race_started')
        yield* hosting.track('not_disclosed')
      }).pipe(Effect.provide(layer), Effect.provide(Logger.replace(Logger.defaultLogger, collect))),
    )
    expect(warnings.flat().join(' ')).toContain('not_disclosed')
    expect(warnings.flat().join(' ')).not.toContain('race_started')
  })
})

// PUB-a: each intended difference from the Ruken adapter, pinned by a test named after it (PUB spec §3.1, §12).
describe('the web adapter: intended differences from the Ruken adapter', () => {
  it('exit fails UNSUPPORTED and is not granted (Ruken standalone: exit does nothing)', async () => {
    const { granted, result } = await onWebPage((hosting) =>
      Effect.map(Effect.either(hosting.exit()), (result) => ({
        granted: hosting.granted.has('exit'),
        result,
      })),
    )
    expect(granted).toBe(false)
    expect(Either.isLeft(result) && result.left).toMatchObject({
      _tag: 'HostError',
      code: 'UNSUPPORTED',
      retryable: false,
      operation: 'session.exit',
    })
  })

  it('blocked storage probe: saves are not granted and every call fails DENIED (Ruken standalone: memory)', () =>
    onWebPage(
      (hosting, fake) =>
        Effect.gen(function* () {
          expect(hosting.granted.has('saves')).toBe(false)
          for (const attempt of [
            hosting.saves.set('progress', '2'),
            hosting.saves.get('progress'),
            hosting.saves.remove('progress'),
            hosting.saves.flush,
          ] as Effect.Effect<unknown, unknown>[]) {
            const result = yield* Effect.either(attempt)
            expect(Either.isLeft(result) && result.left).toMatchObject({
              _tag: 'HostError',
              code: 'DENIED',
              retryable: false,
            })
          }
          // Nothing was kept anywhere, so nothing can be silently lost later.
          expect(fake.writes).toEqual([])
        }),
      { storage: 'blocked' },
    ))

  it('QUOTA_EXCEEDED when the origin quota is full (itch.io games share one origin), keeping the old value', () =>
    onWebPage(
      (hosting) =>
        Effect.gen(function* () {
          yield* hosting.saves.set('progress', 'small')
          const result = yield* Effect.either(hosting.saves.set('progress', 'x'.repeat(200)))
          expect(Either.isLeft(result) && result.left).toMatchObject({
            _tag: 'HostError',
            code: 'QUOTA_EXCEEDED',
            retryable: false,
            operation: 'saves.set',
          })
          expect(yield* hosting.saves.get('progress')).toBe('small')
        }),
      { quotaBytes: 100 },
    ))

  it("flush answers 'device': the saves are in this browser's storage, not a host's outbox (DIST-D3)", () =>
    onWebPage((hosting) =>
      Effect.gen(function* () {
        yield* hosting.saves.set('progress', 'level-2')
        expect(yield* hosting.saves.flush).toEqual({ persisted: 'device' })
      }),
    ))

  it('no handshake wait: Hosting is built and ready without the TestClock moving (Ruken in a frame: up to 10 s)', async () => {
    const { layer } = webHosting()
    const finished = await runScoped(
      Effect.gen(function* () {
        const building = yield* Effect.fork(
          Effect.scoped(Effect.flatMap(Hosting, (hosting) => hosting.ready).pipe(Effect.provide(layer))),
        )
        yield* Effect.yieldNow()
        const done = yield* Fiber.poll(building)
        expect(yield* TestClock.currentTimeMillis).toBe(0)
        return Option.isSome(done) && Exit.isSuccess(done.value)
      }).pipe(Effect.provide(TestContext.TestContext)),
    )
    expect(finished).toBe(true)
  })

  it("no AF copy of Ruken's save limits: the browser's quota is the only limit (spec §9 request 4)", () =>
    // The Ruken SDK refuses a key outside its pattern (INVALID_PAYLOAD) and a value over its per-save size.
    // AF may not copy those limits (AGENTS.md "Ruken first"), and the SDK does not export them, so the web
    // adapter leaves them to Ruken until Ruken publishes them for other hosts.
    onWebPage((hosting) =>
      Effect.gen(function* () {
        yield* hosting.saves.set('not a valid key!', '1')
        expect(yield* hosting.saves.get('not a valid key!')).toBe('1')
      }),
    ))
})

describe('the build target the web adapter names (PUB spec §3)', () => {
  const global = globalThis as { __AUTOMATA_TARGET__?: unknown }
  afterEach(() => {
    delete global.__AUTOMATA_TARGET__
  })

  it("is 'itch' when the build defines __AUTOMATA_TARGET__ as 'itch'", () => {
    global.__AUTOMATA_TARGET__ = 'itch'
    expect(buildTarget()).toBe('itch')
  })

  it("is 'web' when the build defines anything else, or nothing", () => {
    expect(buildTarget()).toBe('web')
    global.__AUTOMATA_TARGET__ = 'ruken'
    expect(buildTarget()).toBe('web')
  })
})
