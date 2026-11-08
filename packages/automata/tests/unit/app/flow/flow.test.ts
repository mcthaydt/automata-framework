import type { AssetsSource } from '@mcthaydt/automata-content'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createFlow, type Flow, type FlowHandle } from '#src/app/flow/flow.manager.ts'
import type { RuntimeServices, ScreenDef } from '#src/app/flow/screen.ts'
import { createVeil } from '#src/app/flow/veil.ts'
import { systemClock } from '#src/shared/lib/clock.ts'
import { type Disposables, disposables } from '#src/shared/lib/disposables.ts'
import { createAssets } from '#src/shared/runtime/assets.manager.ts'
import { createLoadMeter } from '#src/shared/runtime/load-meter.ts'
import { createPageLayers, type PageLayers } from '#src/shared/runtime/page-layers.svelte.ts'
import {
  createPresentationBus,
  type PresentationBus,
} from '#src/shared/runtime/presentation/presentation-bus.manager.ts'
import { createTime, type Time } from '#src/shared/runtime/time/time.manager.ts'
import { createGeometryOwner } from '#src/shared/ui/geometry/geometry-owner.svelte.ts'
import { type FakeClock, fakeClock } from '#src/testing/fake-clock.ts'
import { type FakeRoute, fakeFetch } from '#src/testing/runtime/fake-fetch.ts'
import { settle } from '#src/testing/settle.ts'

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
    opened = disposables()
    clock = fakeClock()
  })

  afterEach(() => {
    opened.dispose()
    layers.dispose()
    root.remove()
    vi.restoreAllMocks()
  })

  /** What each test opened: the flow, then the veil and geometry; disposed after the test, last first. */
  let opened: Disposables
  let clock: FakeClock

  /** Moves the fake clock `ms` forward in 50 ms steps, letting the flow's promises run between steps. */
  const passTime = async (ms: number): Promise<void> => {
    for (let passed = 0; passed < ms; passed += 50) {
      await settle(1)
      clock.advance(50)
    }
    await settle(1)
  }

  const setupHarness = (options: {
    screens: ScreenDef[]
    transitions: Array<{ from: string; event: string; to: string; transition: string }>
    entry?: string
    routes?: Readonly<Record<string, FakeRoute>>
    assetsSource?: AssetsSource
    reducedMotion?: boolean
    runtime?: Disposables
  }): FlowHandle & {
    geometry: ReturnType<typeof createGeometryOwner>
    time: Time
    bus: PresentationBus
    fetchResult: ReturnType<typeof fakeFetch>
  } => {
    bus = createPresentationBus()
    time = createTime(bus)
    const meter = createLoadMeter(systemClock)
    const fetchResult = fakeFetch(options.routes ?? {})
    const assets = createAssets({
      assets: options.assetsSource,
      fonts: {},
      fetch: fetchResult.fetch,
      meter,
    })
    const geometry = createGeometryOwner({ window, root })
    opened.add(() => geometry.dispose())
    const veil = createVeil({
      overlay: layers.overlay,
      reducedMotion: () => options.reducedMotion ?? false,
      clock,
    })
    opened.add(() => veil.dispose())

    const graph = {
      entry: options.entry ?? 'entry',
      screens: options.screens.map((s) => s.id),
      terminal: [],
      transitions: options.transitions,
    }

    const flowHandle = createFlow({
      graph,
      screens: options.screens,
      layers,
      assets,
      time,
      bus,
      geometry,
      veil,
      // These screens read no service.
      services: () => ({}) as RuntimeServices,
      logUnmatched: (screen, event) => logSpy(screen, event),
      ...(options.runtime === undefined ? {} : { runtime: options.runtime }),
    })
    opened.add(() => void flowHandle.dispose())

    return { ...flowHandle, geometry, time, bus, fetchResult }
  }

  it('never has two screens live across a queued transition (exit:a before enter:b)', async () => {
    const log: string[] = []

    const screenA: ScreenDef = {
      id: 'screen-a',
      enter: ({ screen }) => {
        log.push('enter:a')
        screen.add(() => log.push('exit:a'))
      },
    }

    const screenB: ScreenDef = {
      id: 'screen-b',
      enter: ({ screen }) => {
        log.push('enter:b')
        screen.add(() => log.push('exit:b'))
      },
    }

    const harness = setupHarness({
      screens: [screenA, screenB],
      entry: 'screen-a',
      transitions: [{ from: 'screen-a', event: 'next', to: 'screen-b', transition: 'cut' }],
    })

    await harness.start()
    expect(log).toEqual(['enter:a'])

    const dispatched = harness.flow.dispatch('next')
    expect(dispatched).toBe(true)
    await harness.flow.settled()

    expect(log).toEqual(['enter:a', 'exit:a', 'enter:b'])
  })

  it('starts at a screen it is given, or at the entry when the graph has no such screen (a dev restart)', async () => {
    const entered: string[] = []
    const screen = (id: string): ScreenDef => ({ id, enter: () => void entered.push(id) })
    const options = { screens: [screen('title'), screen('room')], entry: 'title', transitions: [] }

    const atRoom = setupHarness(options)
    await atRoom.start('room')
    expect(atRoom.flow.current).toBe('room')
    await atRoom.dispose()

    // A save can rename or drop the screen the person was on: the game starts as usual.
    const atGone = setupHarness(options)
    await atGone.start('gone')
    expect(atGone.flow.current).toBe('title')
    expect(entered).toEqual(['room', 'title'])
  })

  it('a screen is current before its enter is awaited (dispatch inside enter resolves against itself)', async () => {
    let dispatchedFromA = false

    let flowRef: Flow | null = null

    const screenA: ScreenDef = {
      id: 'screen-a',
      enter: () => {
        expect(flowRef?.current).toBe('screen-a')
        dispatchedFromA = flowRef?.dispatch('forward') ?? false
      },
    }

    const screenB: ScreenDef = {
      id: 'screen-b',
      enter: () => {},
    }

    const harness = setupHarness({
      screens: [screenA, screenB],
      entry: 'screen-a',
      transitions: [{ from: 'screen-a', event: 'forward', to: 'screen-b', transition: 'cut' }],
    })

    flowRef = harness.flow
    await harness.start()
    await harness.flow.settled()

    expect(dispatchedFromA).toBe(true)
    expect(harness.flow.current).toBe('screen-b')
  })

  it('a transition to the current screen is a no-op', async () => {
    let enterCount = 0

    const screenA: ScreenDef = {
      id: 'screen-a',
      enter: () => {
        enterCount++
      },
    }

    const harness = setupHarness({
      screens: [screenA],
      entry: 'screen-a',
      transitions: [{ from: 'screen-a', event: 'same', to: 'screen-a', transition: 'cut' }],
    })

    await harness.start()
    expect(enterCount).toBe(1)

    const dispatched = harness.flow.dispatch('same')
    expect(dispatched).toBe(true)
    await harness.flow.settled()

    expect(enterCount).toBe(1)
  })

  it('ScreenContext.from names the previous screen', async () => {
    let aFrom: string | undefined = 'unset'
    let bFrom: string | undefined = 'unset'

    const screenA: ScreenDef = {
      id: 'screen-a',
      enter: (ctx) => {
        aFrom = ctx.from
      },
    }

    const screenB: ScreenDef = {
      id: 'screen-b',
      enter: (ctx) => {
        bFrom = ctx.from
      },
    }

    const harness = setupHarness({
      screens: [screenA, screenB],
      entry: 'screen-a',
      transitions: [{ from: 'screen-a', event: 'to-b', to: 'screen-b', transition: 'cut' }],
    })

    await harness.start()
    expect(aFrom).toBeUndefined()

    harness.flow.dispatch('to-b')
    await harness.flow.settled()

    expect(bFrom).toBe('screen-a')
  })

  it('ScreenContext.runtime is one for every screen: kept across transitions, disposed once after the current screen when the flow is disposed (DX.2c)', async () => {
    const log: string[] = []
    const seen: Disposables[] = []
    const screen = (id: string): ScreenDef => ({
      id,
      enter: (ctx) => {
        seen.push(ctx.runtime)
        // What the screens keep across transitions is released once, by the first screen that holds it.
        if (seen.length === 1) ctx.runtime.add(() => log.push('runtime:closed'))
        ctx.screen.add(() => log.push(`exit:${id}`))
      },
    })

    const harness = setupHarness({
      screens: [screen('screen-a'), screen('screen-b')],
      entry: 'screen-a',
      transitions: [
        { from: 'screen-a', event: 'next', to: 'screen-b', transition: 'cut' },
        { from: 'screen-b', event: 'back', to: 'screen-a', transition: 'cut' },
      ],
    })

    await harness.start()
    harness.flow.dispatch('next')
    await harness.flow.settled()
    harness.flow.dispatch('back')
    await harness.flow.settled()

    expect(seen).toHaveLength(3)
    expect(new Set(seen).size).toBe(1)
    expect(log).toEqual(['exit:screen-a', 'exit:screen-b'])

    await harness.dispose()
    expect(log).toEqual(['exit:screen-a', 'exit:screen-b', 'exit:screen-a', 'runtime:closed'])
  })

  it("a runtime the flow is given is the caller's: disposing the flow leaves it", async () => {
    const runtime = disposables()
    const log: string[] = []
    const harness = setupHarness({
      screens: [{ id: 'screen-a', enter: (ctx) => void ctx.runtime.add(() => log.push('runtime:closed')) }],
      entry: 'screen-a',
      transitions: [],
      runtime,
    })
    await harness.start()
    await harness.dispose()
    expect(log).toEqual([])
    runtime.dispose()
    expect(log).toEqual(['runtime:closed'])
  })

  it('a failed enter closes its scope, removes section element, shows ErrorPanel start copy, and Try again succeeds', async () => {
    let attempts = 0
    const finalizersRun: string[] = []

    const screenA: ScreenDef = {
      id: 'screen-a',
      enter: ({ screen }) => {
        attempts++
        screen.add(() => finalizersRun.push(`exit:${attempts}`))
        if (attempts === 1) {
          throw new Error('boom')
        }
      },
    }

    const harness = setupHarness({
      screens: [screenA],
      entry: 'screen-a',
      transitions: [],
    })

    await harness.start()
    await harness.flow.settled()

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

    await harness.flow.settled()

    expect(attempts).toBe(2)
    expect(layers.screens.querySelector('section[data-screen="screen-a"]')).not.toBeNull()
    expect(layers.overlay.querySelector('[role="alert"]')).toBeNull()
  })

  it('finalizers run once each, most recent first (LIFO order)', async () => {
    const order: string[] = []

    const screenA: ScreenDef = {
      id: 'screen-a',
      enter: ({ screen }) => {
        screen.add(() => order.push('first-added'))
        screen.add(() => order.push('second-added'))
      },
    }

    const screenB: ScreenDef = {
      id: 'screen-b',
      enter: () => {},
    }

    const harness = setupHarness({
      screens: [screenA, screenB],
      entry: 'screen-a',
      transitions: [{ from: 'screen-a', event: 'next', to: 'screen-b', transition: 'cut' }],
    })

    await harness.start()
    harness.flow.dispatch('next')
    await harness.flow.settled()

    expect(order).toEqual(['second-added', 'first-added'])
  })

  it('fade covers then exits and enters then reveals; cut never touches veil; queued requests run under cover', async () => {
    const trace: string[] = []

    const screenA: ScreenDef = {
      id: 'screen-a',
      enter: ({ screen }) => {
        trace.push('enter:a')
        screen.add(() => trace.push('exit:a'))
      },
    }

    const screenB: ScreenDef = {
      id: 'screen-b',
      enter: ({ screen }) => {
        trace.push('enter:b')
        screen.add(() => trace.push('exit:b'))
      },
    }

    const screenC: ScreenDef = {
      id: 'screen-c',
      enter: () => {
        trace.push('enter:c')
      },
    }

    const harness = setupHarness({
      screens: [screenA, screenB, screenC],
      entry: 'screen-a',
      transitions: [
        { from: 'screen-a', event: 'fade-to-b', to: 'screen-b', transition: 'fade' },
        { from: 'screen-b', event: 'fade-to-c', to: 'screen-c', transition: 'fade' },
      ],
    })

    await harness.start()
    trace.length = 0

    // Dispatch fade-to-b and immediately dispatch fade-to-c
    harness.flow.dispatch('fade-to-b')
    harness.flow.dispatch('fade-to-c')

    // Advance clock through veil fade times
    const settled = harness.flow.settled()
    await passTime(1000)
    await settled

    expect(trace).toEqual(['exit:a', 'enter:b', 'exit:b', 'enter:c'])
    expect(harness.flow.current).toBe('screen-c')
  })

  it('reduced motion uses 100 ms for fade veil', async () => {
    const screenA: ScreenDef = {
      id: 'screen-a',
      enter: () => {},
    }
    const screenB: ScreenDef = {
      id: 'screen-b',
      enter: () => {},
    }

    const harness = setupHarness({
      screens: [screenA, screenB],
      entry: 'screen-a',
      reducedMotion: true,
      transitions: [{ from: 'screen-a', event: 'next', to: 'screen-b', transition: 'fade' }],
    })

    await harness.start()
    harness.flow.dispatch('next')

    const settled = harness.flow.settled()
    await passTime(250)
    await settled

    expect(harness.flow.current).toBe('screen-b')
  })

  it('unmatched event: dispatch returns false, nothing changes, logs once per (screen, event) pair in dev', async () => {
    const screenA: ScreenDef = {
      id: 'screen-a',
      enter: () => {},
    }

    const harness = setupHarness({
      screens: [screenA],
      entry: 'screen-a',
      transitions: [],
    })

    await harness.start()

    const res1 = harness.flow.dispatch('unknown-event')
    expect(res1).toBe(false)
    expect(logSpy).toHaveBeenCalledTimes(1)
    expect(logSpy).toHaveBeenCalledWith('screen-a', 'unknown-event')

    // Dispatch again: logged once per pair!
    const res2 = harness.flow.dispatch('unknown-event')
    expect(res2).toBe(false)
    expect(logSpy).toHaveBeenCalledTimes(1)
  })

  it('files are loaded before old screen exits; 404 leaves old screen live with ErrorPanel download', async () => {
    let exitRun = false

    const screenA: ScreenDef = {
      id: 'screen-a',
      enter: ({ screen }) => {
        screen.add(() => {
          exitRun = true
        })
      },
    }

    const screenB: ScreenDef = {
      id: 'screen-b',
      enter: () => {},
    }

    const harness = setupHarness({
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

    await harness.start()
    expect(exitRun).toBe(false)

    harness.flow.dispatch('next')
    await harness.flow.settled()

    // Old screen must still be live
    expect(exitRun).toBe(false)
    expect(harness.flow.current).toBe('screen-a')

    // ErrorPanel with download code is displayed
    const alert = layers.overlay.querySelector('[role="alert"]')
    expect(alert?.getAttribute('data-code')).toBe('download')
  })

  it('after enter: pausesSim sets Time menu reason, primary control focused, geometry.remeasure called, screen.entered published', async () => {
    let remeasureCalled = false

    const events: Array<{ screen: string; from: string | undefined }> = []

    const screenA: ScreenDef = {
      id: 'screen-a',
      pausesSim: true,
      enter: (ctx) => {
        const btn = document.createElement('button')
        btn.setAttribute('data-kind', 'primary')
        ctx.layer.appendChild(btn)
      },
    }

    const harness = setupHarness({
      screens: [screenA],
      entry: 'screen-a',
      transitions: [],
    })

    harness.bus.subscribe('screen.entered', (fact) => events.push(fact))
    harness.geometry.remeasure = () => {
      remeasureCalled = true
    }

    await harness.start()

    expect(harness.time.paused).toBe(true)
    expect(harness.time.reasons.has('menu')).toBe(true)
    expect(remeasureCalled).toBe(true)
    expect(events).toEqual([{ screen: 'screen-a', from: undefined }])

    const primaryBtn = layers.screens.querySelector('button[data-kind="primary"]')
    expect(document.activeElement).toBe(primaryBtn)
  })

  /** A screen of buttons named by `data-testid`; `marks` adds attributes to one of them. */
  const buttonsScreen = (
    id: string,
    names: readonly string[],
    marks: Readonly<Record<string, string>> = {},
    kind?: 'menu' | 'gameplay',
  ): ScreenDef => ({
    id,
    ...(kind === undefined ? {} : { kind }),
    enter: (ctx) => {
      for (const name of names) {
        const button = document.createElement('button')
        button.dataset.testid = name
        if (name === names[0]) button.dataset.kind = 'primary'
        const mark = marks[name]
        if (mark !== undefined) button.setAttribute(mark, '')
        ctx.layer.appendChild(button)
      }
    },
  })
  it("declares a screen's kind, menu or gameplay, for the cursor policy (M4 spec §4.7)", () => {
    // A literal with `kind` typechecks only when ScreenDef declares the field.
    const gameplayScreen: ScreenDef = { id: 'gameplay', kind: 'gameplay', enter: () => {} }
    expect(gameplayScreen.kind).toBe('gameplay')
  })

  const focusedName = (): string | undefined => (document.activeElement as HTMLElement | null)?.dataset.testid

  it('focuses [data-autofocus] on entry before the primary control (M4 spec §4.7)', async () => {
    const harness = setupHarness({
      screens: [buttonsScreen('menu', ['resume', 'settings'], { settings: 'data-autofocus' }, 'menu')],
      entry: 'menu',
      transitions: [],
    })
    await harness.start()
    expect(focusedName()).toBe('settings')
  })

  it('returning to a screen focuses the control the player left it from, matched by name (F-b)', async () => {
    const harness = setupHarness({
      screens: [buttonsScreen('pause', ['resume', 'settings', 'quit']), buttonsScreen('settings', ['back'])],
      entry: 'pause',
      transitions: [
        { from: 'pause', event: 'settings', to: 'settings', transition: 'cut' },
        { from: 'settings', event: 'back', to: 'pause', transition: 'cut' },
      ],
    })
    await harness.start()
    expect(focusedName()).toBe('resume')
    ;(layers.screens.querySelector('[data-testid="settings"]') as HTMLElement).focus()
    harness.flow.dispatch('settings')
    await harness.flow.settled()
    expect(focusedName()).toBe('back')
    harness.flow.dispatch('back')
    await harness.flow.settled()
    expect(focusedName()).toBe('settings')
  })

  it('openMenu() calls current screen openMenu, returns false mid-transition and for screen without one', async () => {
    let menuOpened = false

    const screenA: ScreenDef = {
      id: 'screen-a',
      openMenu: () => {
        menuOpened = true
        return true
      },
      enter: () => {},
    }

    const screenB: ScreenDef = {
      id: 'screen-b',
      enter: () => {},
    }

    const harness = setupHarness({
      screens: [screenA, screenB],
      entry: 'screen-a',
      transitions: [{ from: 'screen-a', event: 'next', to: 'screen-b', transition: 'fade' }],
    })

    await harness.start()

    expect(harness.flow.openMenu()).toBe(true)
    expect(menuOpened).toBe(true)

    // Start transition to B
    harness.flow.dispatch('next')
    // Mid-transition: returns false
    expect(harness.flow.openMenu()).toBe(false)

    const settled = harness.flow.settled()
    await passTime(1000)
    await settled

    // Screen B has no openMenu: returns false
    expect(harness.flow.openMenu()).toBe(false)
  })

  it('reportFailure({ _tag: ScreenFailed, … }) shows panel and Try again re-enters current screen', async () => {
    let enters = 0

    const screenA: ScreenDef = {
      id: 'screen-a',
      enter: () => {
        enters++
      },
    }

    const harness = setupHarness({
      screens: [screenA],
      entry: 'screen-a',
      transitions: [],
    })

    await harness.start()
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

    await harness.flow.settled()

    expect(enters).toBe(2)
    expect(layers.overlay.querySelector('[role="alert"]')).toBeNull()
  })

  it('after the flow is disposed, dispatch returns false', async () => {
    const harness = setupHarness({
      screens: [{ id: 'screen-a', enter: () => {} }],
      entry: 'screen-a',
      transitions: [{ from: 'screen-a', event: 'go', to: 'screen-a', transition: 'cut' }],
    })
    await harness.start()
    await harness.dispose()
    expect(harness.flow.dispatch('go')).toBe(false)
  })

  it('a flow disposed while a screen is entering leaves that screen when its enter is done with', async () => {
    const log: string[] = []
    let finishEnter: () => void = () => undefined
    const harness = setupHarness({
      screens: [
        {
          id: 'slow',
          enter: async ({ screen }) => {
            await new Promise<void>((resolve) => {
              finishEnter = resolve
            })
            screen.add(() => log.push('exit:slow'))
          },
        },
      ],
      entry: 'slow',
      transitions: [],
    })
    const started = harness.start()
    await settle(1)
    await harness.dispose()
    finishEnter()
    await started
    // Added after the screen was left, so it ran at once: nothing an enter starts outlives the flow.
    expect(log).toEqual(['exit:slow'])
  })

  it('settled resolves once queue is empty', async () => {
    const screenA: ScreenDef = { id: 'screen-a', enter: () => {} }
    const screenB: ScreenDef = { id: 'screen-b', enter: () => {} }

    const harness = setupHarness({
      screens: [screenA, screenB],
      entry: 'screen-a',
      transitions: [{ from: 'screen-a', event: 'next', to: 'screen-b', transition: 'cut' }],
    })

    await harness.start()
    harness.flow.dispatch('next')
    await harness.flow.settled()
    expect(harness.flow.current).toBe('screen-b')
  })
})
