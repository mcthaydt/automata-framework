import type { AssetsSource } from '@mcthaydt/automata-content'
import { createGeometryOwner } from '@mcthaydt/automata-ui'
import { Context, Effect, Exit, Scope, TestClock, TestContext } from 'effect'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createPageLayers, type PageLayers } from '../boot/page-layers.svelte.js'
import { makeAssets } from '../loading/assets.manager.js'
import { makeLoadMeter } from '../loading/load-meter.js'
import { makePresentationBus, type PresentationBus } from '../presentation/presentation-bus.manager.js'
import { type FakeRoute, fakeFetch } from '../testing/fake-fetch.js'
import { makeTime, type Time } from '../time/time.manager.js'
import { type Flow, makeFlow } from './flow.manager.js'
import type { RuntimeServices, ScreenDef } from './screen.js'
import { makeVeil } from './veil.js'

describe('Flow and screens (spec §3.6)', () => {
  let root: HTMLElement
  let layers: PageLayers
  let bus: PresentationBus
  let time: Time
  let logSpy: ReturnType<typeof vi.fn<(screen: string, event: string) => void>>

  beforeEach(() => {
    root = document.createElement('div')
    document.body.appendChild(root)
    layers = createPageLayers(root)
    logSpy = vi.fn<(screen: string, event: string) => void>()
  })

  afterEach(() => {
    layers.dispose()
    root.remove()
    vi.restoreAllMocks()
  })

  const setupHarness = (options: {
    screens: ScreenDef[]
    transitions: Array<{ from: string; event: string; to: string; transition: string }>
    entry?: string
    routes?: Readonly<Record<string, FakeRoute>>
    assetsSource?: AssetsSource
    reducedMotion?: boolean
  }) =>
    Effect.gen(function* () {
      bus = yield* makePresentationBus()
      time = makeTime(bus)
      const meter = yield* makeLoadMeter
      const fetchResult = fakeFetch(options.routes ?? {})
      const assets = yield* makeAssets({
        assets: options.assetsSource,
        fonts: {},
        fetch: fetchResult.fetch,
        meter,
      })
      const geometry = createGeometryOwner({ window, root })
      const veil = yield* makeVeil({
        overlay: layers.overlay,
        reducedMotion: () => options.reducedMotion ?? false,
      })

      const graph = {
        entry: options.entry ?? 'entry',
        screens: options.screens.map((s) => s.id),
        terminal: [],
        transitions: options.transitions,
      }

      const flowHandle = yield* makeFlow({
        graph,
        screens: options.screens,
        layers,
        assets,
        time,
        bus,
        geometry,
        veil,
        services: () => Context.empty() as Context.Context<RuntimeServices>,
        logUnmatched: (screen, event) => logSpy(screen, event),
      })

      return {
        ...flowHandle,
        geometry,
        time,
        bus,
        fetchResult,
      }
    })

  it('never has two screens live across a queued transition (exit:a before enter:b)', () =>
    Effect.gen(function* () {
      const log: string[] = []

      const screenA: ScreenDef = {
        id: 'screen-a',
        enter: () =>
          Effect.gen(function* () {
            log.push('enter:a')
            yield* Effect.addFinalizer(() => Effect.sync(() => log.push('exit:a')))
          }),
      }

      const screenB: ScreenDef = {
        id: 'screen-b',
        enter: () =>
          Effect.gen(function* () {
            log.push('enter:b')
            yield* Effect.addFinalizer(() => Effect.sync(() => log.push('exit:b')))
          }),
      }

      const harness = yield* setupHarness({
        screens: [screenA, screenB],
        entry: 'screen-a',
        transitions: [{ from: 'screen-a', event: 'next', to: 'screen-b', transition: 'cut' }],
      })

      yield* harness.start()
      expect(log).toEqual(['enter:a'])

      const dispatched = harness.flow.dispatch('next')
      expect(dispatched).toBe(true)
      yield* harness.flow.settled

      expect(log).toEqual(['enter:a', 'exit:a', 'enter:b'])
    }).pipe(Effect.scoped, Effect.runPromise))

  it('a screen is current before its enter is awaited (dispatch inside enter resolves against itself)', () =>
    Effect.gen(function* () {
      let dispatchedFromA = false

      let flowRef: Flow | null = null

      const screenA: ScreenDef = {
        id: 'screen-a',
        enter: () =>
          Effect.sync(() => {
            expect(flowRef?.current).toBe('screen-a')
            dispatchedFromA = flowRef?.dispatch('forward') ?? false
          }),
      }

      const screenB: ScreenDef = {
        id: 'screen-b',
        enter: () => Effect.void,
      }

      const harness = yield* setupHarness({
        screens: [screenA, screenB],
        entry: 'screen-a',
        transitions: [{ from: 'screen-a', event: 'forward', to: 'screen-b', transition: 'cut' }],
      })

      flowRef = harness.flow
      yield* harness.start()
      yield* harness.flow.settled

      expect(dispatchedFromA).toBe(true)
      expect(harness.flow.current).toBe('screen-b')
    }).pipe(Effect.scoped, Effect.runPromise))

  it('a transition to the current screen is a no-op', () =>
    Effect.gen(function* () {
      let enterCount = 0

      const screenA: ScreenDef = {
        id: 'screen-a',
        enter: () =>
          Effect.sync(() => {
            enterCount++
          }),
      }

      const harness = yield* setupHarness({
        screens: [screenA],
        entry: 'screen-a',
        transitions: [{ from: 'screen-a', event: 'same', to: 'screen-a', transition: 'cut' }],
      })

      yield* harness.start()
      expect(enterCount).toBe(1)

      const dispatched = harness.flow.dispatch('same')
      expect(dispatched).toBe(true)
      yield* harness.flow.settled

      expect(enterCount).toBe(1)
    }).pipe(Effect.scoped, Effect.runPromise))

  it('ScreenContext.from names the previous screen', () =>
    Effect.gen(function* () {
      let aFrom: string | undefined = 'unset'
      let bFrom: string | undefined = 'unset'

      const screenA: ScreenDef = {
        id: 'screen-a',
        enter: (ctx) =>
          Effect.sync(() => {
            aFrom = ctx.from
          }),
      }

      const screenB: ScreenDef = {
        id: 'screen-b',
        enter: (ctx) =>
          Effect.sync(() => {
            bFrom = ctx.from
          }),
      }

      const harness = yield* setupHarness({
        screens: [screenA, screenB],
        entry: 'screen-a',
        transitions: [{ from: 'screen-a', event: 'to-b', to: 'screen-b', transition: 'cut' }],
      })

      yield* harness.start()
      expect(aFrom).toBeUndefined()

      harness.flow.dispatch('to-b')
      yield* harness.flow.settled

      expect(bFrom).toBe('screen-a')
    }).pipe(Effect.scoped, Effect.runPromise))

  it('a failed enter closes its scope, removes section element, shows ErrorPanel start copy, and Try again succeeds', () =>
    Effect.gen(function* () {
      let attempts = 0
      const finalizersRun: string[] = []

      const screenA: ScreenDef = {
        id: 'screen-a',
        enter: () =>
          Effect.gen(function* () {
            attempts++
            yield* Effect.addFinalizer(() => Effect.sync(() => finalizersRun.push(`exit:${attempts}`)))
            if (attempts === 1) {
              return yield* Effect.fail(new Error('boom'))
            }
          }),
      }

      const harness = yield* setupHarness({
        screens: [screenA],
        entry: 'screen-a',
        transitions: [],
      })

      yield* harness.start()
      yield* harness.flow.settled

      expect(attempts).toBe(1)
      expect(finalizersRun).toEqual(['exit:1'])
      expect(layers.screens.querySelector('section[data-screen="screen-a"]')).toBeNull()

      // ErrorPanel is mounted with 'start' code
      const alert = layers.overlay.querySelector('[role="alert"]')
      expect(alert).not.toBeNull()
      expect(alert?.getAttribute('data-code')).toBe('start')

      // Click "Try again"
      const retryBtn = alert?.querySelector('button[data-kind="primary"]') as HTMLButtonElement | null
      expect(retryBtn).not.toBeNull()
      retryBtn?.click()

      yield* harness.flow.settled

      expect(attempts).toBe(2)
      expect(layers.screens.querySelector('section[data-screen="screen-a"]')).not.toBeNull()
      expect(layers.overlay.querySelector('[role="alert"]')).toBeNull()
    }).pipe(Effect.scoped, Effect.runPromise))

  it('finalizers run once each, most recent first (LIFO order)', () =>
    Effect.gen(function* () {
      const order: string[] = []

      const screenA: ScreenDef = {
        id: 'screen-a',
        enter: () =>
          Effect.gen(function* () {
            yield* Effect.addFinalizer(() => Effect.sync(() => order.push('first-added')))
            yield* Effect.addFinalizer(() => Effect.sync(() => order.push('second-added')))
          }),
      }

      const screenB: ScreenDef = {
        id: 'screen-b',
        enter: () => Effect.void,
      }

      const harness = yield* setupHarness({
        screens: [screenA, screenB],
        entry: 'screen-a',
        transitions: [{ from: 'screen-a', event: 'next', to: 'screen-b', transition: 'cut' }],
      })

      yield* harness.start()
      harness.flow.dispatch('next')
      yield* harness.flow.settled

      expect(order).toEqual(['second-added', 'first-added'])
    }).pipe(Effect.scoped, Effect.runPromise))

  it('fade covers then exits and enters then reveals; cut never touches veil; queued requests run under cover', () =>
    Effect.gen(function* () {
      const trace: string[] = []

      const screenA: ScreenDef = {
        id: 'screen-a',
        enter: () =>
          Effect.gen(function* () {
            trace.push('enter:a')
            yield* Effect.addFinalizer(() => Effect.sync(() => trace.push('exit:a')))
          }),
      }

      const screenB: ScreenDef = {
        id: 'screen-b',
        enter: () =>
          Effect.gen(function* () {
            trace.push('enter:b')
            yield* Effect.addFinalizer(() => Effect.sync(() => trace.push('exit:b')))
          }),
      }

      const screenC: ScreenDef = {
        id: 'screen-c',
        enter: () =>
          Effect.sync(() => {
            trace.push('enter:c')
          }),
      }

      const harness = yield* setupHarness({
        screens: [screenA, screenB, screenC],
        entry: 'screen-a',
        transitions: [
          { from: 'screen-a', event: 'fade-to-b', to: 'screen-b', transition: 'fade' },
          { from: 'screen-b', event: 'fade-to-c', to: 'screen-c', transition: 'fade' },
        ],
      })

      yield* harness.start()
      trace.length = 0

      // Dispatch fade-to-b and immediately dispatch fade-to-c
      harness.flow.dispatch('fade-to-b')
      harness.flow.dispatch('fade-to-c')

      // Advance clock through veil fade times
      const fiber = yield* Effect.fork(harness.flow.settled)
      yield* TestClock.adjust('1000 millis')
      yield* Effect.fromFiber(fiber)

      expect(trace).toEqual(['exit:a', 'enter:b', 'exit:b', 'enter:c'])
      expect(harness.flow.current).toBe('screen-c')
    }).pipe(Effect.scoped, Effect.provide(TestContext.TestContext), Effect.runPromise))

  it('reduced motion uses 100 ms for fade veil', () =>
    Effect.gen(function* () {
      const screenA: ScreenDef = {
        id: 'screen-a',
        enter: () => Effect.void,
      }
      const screenB: ScreenDef = {
        id: 'screen-b',
        enter: () => Effect.void,
      }

      const harness = yield* setupHarness({
        screens: [screenA, screenB],
        entry: 'screen-a',
        reducedMotion: true,
        transitions: [{ from: 'screen-a', event: 'next', to: 'screen-b', transition: 'fade' }],
      })

      yield* harness.start()
      harness.flow.dispatch('next')

      const fiber = yield* Effect.fork(harness.flow.settled)
      yield* TestClock.adjust('250 millis')
      yield* Effect.fromFiber(fiber)

      expect(harness.flow.current).toBe('screen-b')
    }).pipe(Effect.scoped, Effect.provide(TestContext.TestContext), Effect.runPromise))

  it('unmatched event: dispatch returns false, nothing changes, logs once per (screen, event) pair in dev', () =>
    Effect.gen(function* () {
      const screenA: ScreenDef = {
        id: 'screen-a',
        enter: () => Effect.void,
      }

      const harness = yield* setupHarness({
        screens: [screenA],
        entry: 'screen-a',
        transitions: [],
      })

      yield* harness.start()

      const res1 = harness.flow.dispatch('unknown-event')
      expect(res1).toBe(false)
      expect(logSpy).toHaveBeenCalledTimes(1)
      expect(logSpy).toHaveBeenCalledWith('screen-a', 'unknown-event')

      // Dispatch again: logged once per pair!
      const res2 = harness.flow.dispatch('unknown-event')
      expect(res2).toBe(false)
      expect(logSpy).toHaveBeenCalledTimes(1)
    }).pipe(Effect.scoped, Effect.runPromise))

  it('files are loaded before old screen exits; 404 leaves old screen live with ErrorPanel download', () =>
    Effect.gen(function* () {
      let exitRun = false

      const screenA: ScreenDef = {
        id: 'screen-a',
        enter: () =>
          Effect.gen(function* () {
            yield* Effect.addFinalizer(() =>
              Effect.sync(() => {
                exitRun = true
              }),
            )
          }),
      }

      const screenB: ScreenDef = {
        id: 'screen-b',
        enter: () => Effect.void,
      }

      const harness = yield* setupHarness({
        screens: [screenA, screenB],
        entry: 'screen-a',
        assetsSource: {
          screens: {
            'screen-b': { files: ['/missing.bin'] },
          },
        },
        routes: {
          // 404 for missing.bin
          '/missing.bin': { status: 404 },
        },
        transitions: [{ from: 'screen-a', event: 'next', to: 'screen-b', transition: 'cut' }],
      })

      yield* harness.start()
      expect(exitRun).toBe(false)

      harness.flow.dispatch('next')
      yield* harness.flow.settled

      // Old screen must still be live
      expect(exitRun).toBe(false)
      expect(harness.flow.current).toBe('screen-a')

      // ErrorPanel with download code is displayed
      const alert = layers.overlay.querySelector('[role="alert"]')
      expect(alert?.getAttribute('data-code')).toBe('download')
    }).pipe(Effect.scoped, Effect.runPromise))

  it('after enter: pausesSim sets Time menu reason, primary control focused, geometry.remeasure called, screen.entered published', () =>
    Effect.gen(function* () {
      let remeasureCalled = false

      const events: Array<{ screen: string; from: string | undefined }> = []

      const screenA: ScreenDef = {
        id: 'screen-a',
        pausesSim: true,
        enter: (ctx) =>
          Effect.sync(() => {
            const btn = document.createElement('button')
            btn.setAttribute('data-kind', 'primary')
            ctx.layer.appendChild(btn)
          }),
      }

      const harness = yield* setupHarness({
        screens: [screenA],
        entry: 'screen-a',
        transitions: [],
      })

      harness.bus.subscribe('screen.entered', (fact) => events.push(fact))
      harness.geometry.remeasure = () => {
        remeasureCalled = true
      }

      yield* harness.start()

      expect(harness.time.paused).toBe(true)
      expect(harness.time.reasons.has('menu')).toBe(true)
      expect(remeasureCalled).toBe(true)
      expect(events).toEqual([{ screen: 'screen-a', from: undefined }])

      const primaryBtn = layers.screens.querySelector('button[data-kind="primary"]')
      expect(document.activeElement).toBe(primaryBtn)
    }).pipe(Effect.scoped, Effect.runPromise))

  it('openMenu() calls current screen openMenu, returns false mid-transition and for screen without one', () =>
    Effect.gen(function* () {
      let menuOpened = false

      const screenA: ScreenDef = {
        id: 'screen-a',
        openMenu: () => {
          menuOpened = true
          return true
        },
        enter: () => Effect.void,
      }

      const screenB: ScreenDef = {
        id: 'screen-b',
        enter: () => Effect.void,
      }

      const harness = yield* setupHarness({
        screens: [screenA, screenB],
        entry: 'screen-a',
        transitions: [{ from: 'screen-a', event: 'next', to: 'screen-b', transition: 'fade' }],
      })

      yield* harness.start()

      expect(harness.flow.openMenu()).toBe(true)
      expect(menuOpened).toBe(true)

      // Start transition to B
      harness.flow.dispatch('next')
      // Mid-transition: returns false
      expect(harness.flow.openMenu()).toBe(false)

      const fiber = yield* Effect.fork(harness.flow.settled)
      yield* TestClock.adjust('1000 millis')
      yield* Effect.fromFiber(fiber)

      // Screen B has no openMenu: returns false
      expect(harness.flow.openMenu()).toBe(false)
    }).pipe(Effect.scoped, Effect.provide(TestContext.TestContext), Effect.runPromise))

  it('reportFailure({ _tag: ScreenFailed, … }) shows panel and Try again re-enters current screen', () =>
    Effect.gen(function* () {
      let enters = 0

      const screenA: ScreenDef = {
        id: 'screen-a',
        enter: () =>
          Effect.sync(() => {
            enters++
          }),
      }

      const harness = yield* setupHarness({
        screens: [screenA],
        entry: 'screen-a',
        transitions: [],
      })

      yield* harness.start()
      expect(enters).toBe(1)

      harness.reportFailure({
        _tag: 'ScreenFailed',
        screen: 'screen-a',
        cause: new Error('sim faulted'),
      })

      const alert = layers.overlay.querySelector('[role="alert"]')
      expect(alert).not.toBeNull()
      expect(alert?.getAttribute('data-code')).toBe('start')

      const retryBtn = alert?.querySelector('button[data-kind="primary"]') as HTMLButtonElement | null
      retryBtn?.click()

      yield* harness.flow.settled

      expect(enters).toBe(2)
      expect(layers.overlay.querySelector('[role="alert"]')).toBeNull()
    }).pipe(Effect.scoped, Effect.runPromise))

  it('after scope closes, dispatch returns false', () =>
    Effect.gen(function* () {
      const screenA: ScreenDef = {
        id: 'screen-a',
        enter: () => Effect.void,
      }

      const runtimeScope = yield* Scope.make()

      const harness = yield* setupHarness({
        screens: [screenA],
        entry: 'screen-a',
        transitions: [{ from: 'screen-a', event: 'go', to: 'screen-a', transition: 'cut' }],
      }).pipe(Scope.extend(runtimeScope))

      yield* harness.start()

      yield* Scope.close(runtimeScope, Exit.void)

      expect(harness.flow.dispatch('go')).toBe(false)
    }).pipe(Effect.runPromise))

  it('settled resolves once queue is empty', () =>
    Effect.gen(function* () {
      const screenA: ScreenDef = { id: 'screen-a', enter: () => Effect.void }
      const screenB: ScreenDef = { id: 'screen-b', enter: () => Effect.void }

      const harness = yield* setupHarness({
        screens: [screenA, screenB],
        entry: 'screen-a',
        transitions: [{ from: 'screen-a', event: 'next', to: 'screen-b', transition: 'cut' }],
      })

      yield* harness.start()
      harness.flow.dispatch('next')
      yield* harness.flow.settled
      expect(harness.flow.current).toBe('screen-b')
    }).pipe(Effect.scoped, Effect.runPromise))
})
