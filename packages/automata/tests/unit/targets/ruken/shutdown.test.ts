import type { SdkEnv, SdkMessagePort } from '@ruken/sdk'
import { settle } from '@ruken/sdk-host/testing'
import { describe, expect, it, vi } from 'vitest'
import type { HostResult } from '#src/shared/host/plain-errors.ts'
import { HOST_EXIT_CAP_MS, type Hosting } from '#src/shared/host/plain-hosting.ts'
import { fakeClock } from '#src/testing/fake-clock.ts'
import {
  type FakeHostHandle,
  type HostingTestOptions,
  manualClock,
  openHostingTest,
  withHostingTest,
} from '#src/testing/host/page/index.ts'

/** Opens `Hosting` on its own, so a test can dispose it part-way. */
async function open(options: HostingTestOptions = {}) {
  const opened = await openHostingTest(options)
  if (!opened.ok) throw new Error('refused')
  return opened.value
}

describe('shutting Hosting down (audit of PR #5)', () => {
  it('stops every observed subscription when Hosting is disposed', async () => {
    const {
      hosting,
      handle: { host },
      dispose,
    } = await open()
    const heard: unknown[] = []
    for (const observed of [
      hosting.lifecycle,
      hosting.input,
      hosting.display,
      hosting.audio,
      hosting.entitlements,
      hosting.savesStatus,
    ] as { subscribe(listener: (value: unknown) => void): () => void }[]) {
      observed.subscribe((value) => heard.push(value))
    }
    await settle()
    // Each gave its current value on subscribing.
    expect(heard).toHaveLength(6)
    hosting.dispose()
    // The host keeps talking; nobody listens any more.
    await host.bridge.setMasterAudio(0.5, false)
    await host.bridge.setOverlay('drawer')
    await settle()
    expect(heard).toHaveLength(6)
    dispose()
  })

  it('stops the saves changed listener when Hosting is disposed (M5 spec §4.1)', async () => {
    const { hosting, dispose } = await open()
    const heard: unknown[] = []
    hosting.saves.changed.subscribe((change) => heard.push(change))
    await settle()
    hosting.dispose()
    expect(heard).toEqual([])
    dispose()
  })

  it('stops the round ended listener when Hosting is disposed (M5.2 plan step 3)', async () => {
    const { hosting, dispose } = await open()
    const heard: unknown[] = []
    hosting.round.ended.subscribe((outcome) => heard.push(outcome))
    hosting.dispose()
    hosting.round.start()
    hosting.round.end('complete')
    expect(heard).toEqual([])
    dispose()
  })

  it('refuses saves and requests on a disposed Hosting with CANCELLED instead of dropping them', async () => {
    const { hosting, handle, dispose } = await open()
    hosting.dispose()
    const attempts: Promise<HostResult<unknown>>[] = [
      hosting.saves.set('progress', '2'),
      hosting.saves.get('progress'),
      hosting.saves.remove('progress'),
      hosting.saves.flush(),
      hosting.saves.keys(),
      hosting.setFullscreen(true),
      hosting.exit(),
    ]
    for (const attempt of attempts) {
      expect(await attempt).toMatchObject({ ok: false, reason: { code: 'CANCELLED' } })
    }
    expect(handle.sentByGame('saves.set')).toEqual([])
    dispose()
  })
})

describe('the built-in save flush on exit (FloorFifty ruken/exit.ts)', () => {
  it('flushes pending saves before the game tells the host it is ready to close, with no handler registered', () =>
    withHostingTest(async ({ hosting, handle: { host } }) => {
      await hosting.saves.set('progress', '2')
      await host.bridge.exit()
      const sent = host.messages.filter((entry) => entry.dir === 'in').map((entry) => entry.msg.type)
      expect(sent.indexOf('saves.flush')).toBeGreaterThan(-1)
      expect(sent.indexOf('session.exitReady')).toBeGreaterThan(sent.indexOf('saves.flush'))
    }))

  it('stops waiting for a flush the host never answers after HOST_EXIT_CAP_MS', async () => {
    const hostClock = manualClock()
    const clock = fakeClock()
    await withHostingTest(
      async ({ hosting, handle: { host, sentByGame } }) => {
        await hosting.saves.set('progress', '2')
        const closing = host.bridge.exit()
        await settle()
        expect(sentByGame('session.exitReady')).toEqual([])
        clock.advance(HOST_EXIT_CAP_MS)
        await settle()
        expect(sentByGame('session.exitReady')).toHaveLength(1)
        hostClock.advance(10_000)
        await closing
      },
      { host: { clock: hostClock }, env: swallowGameMessages('saves.flush') },
      { clock },
    )
  })
})

/**
 * The SDK runs its `exiting` listeners together, so a game's last write and the
 * host flush would race: the flush can leave before the write reaches the SDK's
 * outbox. Hosting orders them (M5.2 plan step 2): the game's handlers one after
 * another in registration order, then the flush, inside one HOST_EXIT_CAP_MS.
 */
describe('the order of exit handlers and the flush (M5.2)', () => {
  /** A handler that finishes after `millis` on `clock`. */
  const sleep = (clock: ReturnType<typeof fakeClock>, millis: number) =>
    new Promise<void>((resolve) => void clock.setTimeout(resolve, millis))

  /** Closes the game and lets `millis` of the adapter's time pass inside the exit, so a sleeping handler finishes. */
  async function closeAfter(
    host: FakeHostHandle['host'],
    hostClock: ReturnType<typeof manualClock>,
    clock: ReturnType<typeof fakeClock>,
    millis: number,
  ) {
    const closing = host.bridge.exit()
    await settle()
    clock.advance(millis)
    await settle()
    hostClock.advance(10_000)
    await closing
  }

  it('waits for a handler that writes late, then flushes, then tells the host it is ready', async () => {
    const hostClock = manualClock()
    const clock = fakeClock()
    await withHostingTest(
      async ({ hosting, handle: { host, sentByGame } }) => {
        hosting.onExiting(async () => {
          await sleep(clock, 100)
          await hosting.saves.set('late', '1')
        })
        await closeAfter(host, hostClock, clock, 100)
        const order = host.messages
          .filter((entry) => entry.dir === 'in')
          .map((entry) => entry.msg.type)
          .filter((type) => ['saves.set', 'saves.flush', 'session.exitReady'].includes(type))
        expect(order).toEqual(['saves.set', 'saves.flush', 'session.exitReady'])
        expect(sentByGame('saves.flush')).toHaveLength(1)
      },
      { host: { clock: hostClock } },
      { clock },
    )
  })

  it('runs handlers one after another, in the order they were registered', async () => {
    const hostClock = manualClock()
    const clock = fakeClock()
    const ran: string[] = []
    await withHostingTest(
      async ({ hosting, handle: { host } }) => {
        hosting.onExiting(async () => {
          await sleep(clock, 50)
          ran.push('first')
        })
        hosting.onExiting(() => void ran.push('second'))
        await closeAfter(host, hostClock, clock, 50)
        expect(ran).toEqual(['first', 'second'])
      },
      { host: { clock: hostClock } },
      { clock },
    )
  })

  it('skips a handler that was taken back, and carries on past one that fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const hostClock = manualClock()
    const clock = fakeClock()
    const ran: string[] = []
    await withHostingTest(
      async ({ hosting, handle: { host, sentByGame } }) => {
        hosting.onExiting(() => void ran.push('first'))
        const takeBack = hosting.onExiting(() => void ran.push('gone'))
        hosting.onExiting(() => {
          throw new Error('a handler broke')
        })
        hosting.onExiting(() => void ran.push('last'))
        takeBack()
        await closeAfter(host, hostClock, clock, 0)
        expect(ran).toEqual(['first', 'last'])
        expect(sentByGame('saves.flush')).toHaveLength(1)
      },
      { host: { clock: hostClock } },
      { clock },
    )
    warn.mockRestore()
  })

  it('answers the host at HOST_EXIT_CAP_MS when a handler never returns, and the flush is skipped', async () => {
    const hostClock = manualClock()
    const clock = fakeClock()
    await withHostingTest(
      async ({ hosting, handle: { host, sentByGame } }) => {
        await hosting.saves.set('progress', '2')
        hosting.onExiting(() => new Promise<void>(() => undefined))
        const closing = host.bridge.exit()
        await settle()
        expect(sentByGame('session.exitReady')).toEqual([])
        clock.advance(HOST_EXIT_CAP_MS)
        await settle()
        expect(sentByGame('session.exitReady')).toHaveLength(1)
        expect(sentByGame('saves.flush')).toEqual([])
        hostClock.advance(10_000)
        await closing
      },
      { host: { clock: hostClock } },
      { clock },
    )
  })
})

describe('lower-severity audit items', () => {
  it('warns when track() drops an event', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    return withHostingTest(
      ({ hosting }: { hosting: Hosting }) => {
        hosting.track('not_disclosed')
        expect(warn.mock.calls.flat().join(' ')).toContain('not_disclosed')
        warn.mockRestore()
      },
      { hosting: { wants: ['analytics.custom'], disclosedEvents: ['race_started'] } },
    )
  })

  it('can be given up on during the handshake, and disposes the session that arrives late', async () => {
    const clock = manualClock()
    const abort = new AbortController()
    let disposed = 0
    // Hold the welcome until after the abort, and count port closes (session.dispose).
    const opening = openHostingTest(
      { host: { clock }, env: delayWelcomeAndCountCloses(() => (disposed += 1)) },
      { signal: abort.signal },
    )
    await settle()
    abort.abort()
    expect(await opening).toMatchObject({ ok: false, reason: { code: 'CANCELLED', operation: 'init' } })
    releaseHeldWelcome()
    await settle()
    expect(disposed).toBe(1)
  })

  it('is refused with a typed reason, not a crash, when the host options are invalid', async () => {
    const opened = await openHostingTest({ hosting: { testHostOrigins: ['http://not-https.test'] } })
    expect(opened).toMatchObject({ ok: false, reason: { operation: 'init' } })
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
