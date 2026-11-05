import type { SdkEnv, SdkMessagePort } from '@ruken/sdk'
import { settle } from '@ruken/sdk-host/testing'
import { describe, expect, it, vi } from 'vitest'
import { HOST_EXIT_CAP_MS } from '#src/shared/host/plain-hosting.ts'
import { fakeClock } from '#src/testing/fake-clock.ts'
import { type FakeHostHandle, manualClock, withHostingTest } from '#src/testing/host/page/index.ts'

const sentToGame = (host: FakeHostHandle['host'], type: string): unknown[] =>
  host.messages.filter((entry) => entry.dir === 'out' && entry.msg.type === type)

describe("the host's Open game menu (FloorFifty menu-request; S6 answer 6)", () => {
  // The host sends menu.open only to a game that asked for the `menu` capability.
  const menuHost = { hosting: { wants: ['menu' as const] } }

  it('is refused until a handler says yes, and again once the handler is taken back', () =>
    withHostingTest(async ({ hosting, handle: { host } }) => {
      expect(await host.bridge.openGameMenu()).toBe(false)
      expect(sentToGame(host, 'menu.open')).toHaveLength(1)

      const takeBack = hosting.onMenuRequest(() => true)
      expect(await host.bridge.openGameMenu()).toBe(true)

      takeBack()
      expect(await host.bridge.openGameMenu()).toBe(false)
    }, menuHost))

  it('is answered by the latest handler', () =>
    withHostingTest(async ({ hosting, handle: { host } }) => {
      hosting.onMenuRequest(() => true)
      hosting.onMenuRequest(() => false)
      expect(await host.bridge.openGameMenu()).toBe(false)
    }, menuHost))

  it('before session.ready, a menu.open never reaches the handler and is refused', async () => {
    // Ruken's answer 6 says the SDK answers NOT_READY here, but the SDK at d0fa2fe (as at b30d31b) has no
    // such check (only the host-side bridge refuses to send menu.open before ready), so
    // AF's dispatcher holds handlers back until ready (coordinator decision, 2026-10-11).
    // The fake host never sends menu.open before ready, so the test puts one on the game's port.
    const injected = interceptGamePort()
    let asked = 0
    await withHostingTest(
      async ({ hosting, handle: { host } }) => {
        hosting.onMenuRequest(() => {
          asked += 1
          return true
        })
        injected.send({ ruken: 1, id: 'early-menu', kind: 'req', type: 'menu.open', payload: {} })
        await settle()
        expect(injected.answered('early-menu')).toMatchObject({ kind: 'res', payload: { opened: false } })
        expect(asked).toBe(0)

        // Once the host says ready, the same handler answers.
        await host.bridge.markReady()
        await settle()
        injected.send({ ruken: 1, id: 'menu-after-ready', kind: 'req', type: 'menu.open', payload: {} })
        await settle()
        expect(injected.answered('menu-after-ready')).toMatchObject({ payload: { opened: true } })
        expect(asked).toBe(1)
      },
      { hosting: { wants: ['menu'] }, host: { autoReady: false }, env: injected.env },
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
  it('runs the exiting handler before the game tells the host it is ready to go', () =>
    withHostingTest(async ({ hosting, handle: { host, sentByGame } }) => {
      await hosting.saves.set('progress', '2')
      hosting.onExiting(async () => void (await hosting.saves.flush()))
      await host.bridge.exit()
      const sent = host.messages.filter((entry) => entry.dir === 'in').map((entry) => entry.msg.type)
      expect(sent.indexOf('saves.flush')).toBeGreaterThan(-1)
      expect(sent.indexOf('session.exitReady')).toBeGreaterThan(sent.indexOf('saves.flush'))
      expect(sentByGame('session.exitReady')).toHaveLength(1)
    }))

  it('cuts a handler that never finishes at HOST_EXIT_CAP_MS, on the clock it was given', async () => {
    const hostClock = manualClock()
    const clock = fakeClock()
    await withHostingTest(
      async ({ hosting, handle: { host, sentByGame } }) => {
        hosting.onExiting(() => new Promise<void>(() => undefined))
        const closing = host.bridge.exit()
        await settle()
        expect(sentByGame('session.exitReady')).toEqual([])

        clock.advance(HOST_EXIT_CAP_MS)
        await settle()
        expect(sentByGame('session.exitReady')).toHaveLength(1)
        hostClock.advance(2_000)
        await closing
      },
      { host: { clock: hostClock } },
      { clock },
    )
  })

  it('stops calling a handler once it is taken back', () => {
    let ran = 0
    return withHostingTest(async ({ hosting, handle: { host } }) => {
      const takeBack = hosting.onExiting(() => {
        ran += 1
      })
      takeBack()
      await host.bridge.exit()
      expect(ran).toBe(0)
    })
  })
})

describe('requests', () => {
  it("exit hands the player back to the host, with the reason 'player' by default", () =>
    withHostingTest(async ({ hosting, handle: { sentByGame } }) => {
      void hosting.exit()
      await settle()
      void hosting.exit('completed')
      await settle()
      expect(sentByGame('session.exit')).toEqual([{ reason: 'player' }, { reason: 'completed' }])
    }))

  it("asks the host for fullscreen and returns Ruken's answer, including support (FloorFifty fullscreen-hosted)", () =>
    withHostingTest(
      async ({ hosting, handle: { host } }) => {
        const asked = hosting.setFullscreen(true)
        await settle()
        expect(await asked).toEqual({ ok: true, value: { fullscreen: false, support: 'ios-home-screen' } })
        expect(host.ui.callsTo('requestFullscreen')).toEqual([[true]])
      },
      {
        host: { ui: { requestFullscreen: async () => ({ fullscreen: false, support: 'ios-home-screen' }) } },
      },
    ))

  it('sends one round start per round, and an end only for an open round (FloorFifty rounds)', () =>
    withHostingTest(async ({ hosting, handle: { sentByGame } }) => {
      hosting.round.end('quit')
      hosting.round.start()
      hosting.round.start()
      hosting.round.end('complete')
      hosting.round.end('quit')
      await settle()
      expect(sentByGame('telemetry.round')).toEqual([{ kind: 'start' }, { kind: 'end', outcome: 'complete' }])
    }))
})

describe('round ends as an observable (M5.2 plan step 3)', () => {
  it('gives one event per round that ended, with its outcome, and none for a dropped end', () =>
    withHostingTest(async ({ hosting }) => {
      const heard: (string | undefined)[] = []
      hosting.round.ended.subscribe((outcome) => heard.push(outcome))
      await settle()
      hosting.round.end('quit') // no round open: dropped
      hosting.round.start()
      hosting.round.start() // second start: dropped
      hosting.round.end('complete')
      hosting.round.end('quit') // already ended: dropped
      hosting.round.start()
      hosting.round.end()
      expect(heard).toEqual(['complete', undefined])
    }))
})

describe('analytics (FloorFifty analytics)', () => {
  const analyticsHost = (consent: boolean) => ({
    hosting: {
      wants: ['analytics.custom' as const],
      disclosedEvents: ['race_started', 'tutorial_completed'],
    },
    host: { consent: { analytics: consent } },
  })

  it('sends a disclosed event with its props when the player consented', () =>
    withHostingTest(async ({ hosting, handle: { sentByGame } }) => {
      hosting.track('race_started', { mode: 'quick' })
      hosting.track('tutorial_completed')
      await settle()
      expect(sentByGame('analytics.track')).toEqual([
        { name: 'race_started', props: { mode: 'quick' } },
        { name: 'tutorial_completed' },
      ])
    }, analyticsHost(true)))

  it('sends nothing without consent', () =>
    withHostingTest(async ({ hosting, handle: { sentByGame } }) => {
      hosting.track('race_started', { mode: 'quick' })
      await settle()
      expect(sentByGame('analytics.track')).toEqual([])
    }, analyticsHost(false)))

  it('drops an event that is not disclosed, and never fails on one the SDK refuses', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    return withHostingTest(async ({ hosting, handle: { sentByGame } }) => {
      hosting.track('secret_event')
      hosting.track('race_started', { nested: { no: true } } as never)
      await settle()
      expect(sentByGame('analytics.track')).toEqual([])
      warn.mockRestore()
    }, analyticsHost(true))
  })
})
