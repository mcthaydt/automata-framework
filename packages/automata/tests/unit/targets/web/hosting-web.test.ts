import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildTarget,
  createWebHosting,
  WEB_STORAGE_PROBE_KEY,
  type WebTarget,
} from '#src/features/targets/web/hosting-web.ts'
import type { HostingOptions } from '#src/shared/host/hosting.ts'
import type { HostResult } from '#src/shared/host/plain-errors.ts'
import type { Hosting } from '#src/shared/host/plain-hosting.ts'
import { describeHostingContract } from '#src/testing/host/contract-suite.ts'
import {
  type FakeWebPage,
  type FakeWebPageOptions,
  fakeWebPage,
} from '#src/testing/host/page/fake-web-page.ts'
import { unwrap } from '#src/testing/unwrap.ts'

const OPTIONS: HostingOptions = { gameId: 'blank-game', wants: ['saves'], pauseBehavior: 'pause' }

/** The web adapter over a fake page; the page is returned so a test can drive it. */
function webHosting(pageOptions: FakeWebPageOptions = {}, target: WebTarget = 'web', hosting = OPTIONS) {
  const fake: FakeWebPage = fakeWebPage(pageOptions)
  return { fake, hosting: createWebHosting(hosting, fake.page, target) }
}

/** One macrotask: the web adapter answers at once, so this only lets pending promises finish. */
const delivered = (): Promise<void> => new Promise<void>((resolve) => setTimeout(resolve, 0))

// PUB-a and DIST-c: the contract cases every adapter passes (the Ruken adapter's run is in
// `ruken/hosting-ruken.contract.test.ts`).
describeHostingContract('the web adapter over a page', () => webHosting().hosting, delivered)

/** Runs `program` against the web adapter over a fresh fake page, then disposes it. */
async function onWebPage<A>(
  program: (hosting: Hosting, fake: FakeWebPage) => Promise<A> | A,
  pageOptions: FakeWebPageOptions = {},
  target: WebTarget = 'web',
): Promise<A> {
  const { fake, hosting } = webHosting(pageOptions, target)
  try {
    return await program(hosting, fake)
  } finally {
    hosting.dispose()
  }
}

/**
 * Collects every value `observed` gives (the current one first). `step` runs page events one at a time, each
 * delivered before the next, so the test sees each change on its own.
 */
function record<A>(observed: { subscribe(listener: (value: A) => void): () => void }) {
  const values: A[] = []
  observed.subscribe((value) => values.push(value))
  const step = async (...events: (() => void)[]) => {
    for (const event of events) {
      event()
      await delivered()
    }
  }
  return { values, step }
}

describe('the web adapter: what a page outside Ruken can observe (PUB spec §3.1)', () => {
  it('names itch.io for an itch build and "this page" for a web build', async () => {
    expect(await onWebPage((hosting) => hosting.hostName, {}, 'itch')).toBe('itch.io')
    expect(await onWebPage((hosting) => hosting.hostName, {}, 'web')).toBe('this page')
    expect(await onWebPage((hosting) => hosting.kind)).toBe('web')
  })

  it("reads the browser's language, else en, and the SDK's standalone player", async () => {
    expect(await onWebPage((hosting) => hosting.locale, { language: 'fr-CA' })).toBe('fr-CA')
    expect(await onWebPage((hosting) => hosting.locale)).toBe('en')
    expect(await onWebPage((hosting) => hosting.player)).toEqual({ id: 'standalone', displayName: '' })
  })

  it('grants lifecycle, input, display, audio and saves, and nothing it cannot do', async () => {
    const granted = await onWebPage((hosting) => [...hosting.granted].sort())
    expect(granted).toEqual(['audio', 'display', 'input', 'lifecycle', 'saves'])
  })

  it('lifecycle goes to background when the tab is hidden or the page loses focus, with reasons', () =>
    onWebPage(async (hosting, fake) => {
      const { values, step } = record(hosting.lifecycle)
      await step(
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
      expect(hosting.lifecycle.get()).toEqual({ state: 'active', reasons: [] })
    }))

  it('input mode follows real pointer, touch, keyboard and gamepad events', () =>
    onWebPage(async (hosting, fake) => {
      const { values, step } = record(hosting.input)
      await step(
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
    }))

  it('starts in touch mode on a coarse pointer (a phone)', async () => {
    const input = await onWebPage((hosting) => hosting.input.get(), { coarsePointer: true })
    expect(input).toEqual({ mode: 'touch' })
  })

  it("display follows the visual viewport's orientation", () =>
    onWebPage(
      async (hosting, fake) => {
        const { values, step } = record(hosting.display)
        await step(
          () => fake.resize(390, 844),
          // Still portrait (a browser bar or keyboard): no change is reported.
          () => fake.resize(390, 700),
          () => fake.resize(844, 390),
        )
        expect(values.map((metrics) => metrics.orientation)).toEqual(['landscape', 'portrait', 'landscape'])
        expect(values[0]?.hostReserved.rect).toEqual({ x: 0, y: 0, w: 0, h: 0 })
      },
      { width: 1280, height: 720 },
    ))

  it('setFullscreen uses the Element Fullscreen API and display reports it', () =>
    onWebPage(async (hosting) => {
      expect(unwrap(await hosting.setFullscreen(true))).toEqual({ fullscreen: true, support: 'element' })
      expect(hosting.display.get().fullscreen).toBe(true)
      expect(unwrap(await hosting.setFullscreen(false))).toEqual({ fullscreen: false, support: 'element' })
      expect(hosting.display.get().fullscreen).toBe(false)
    }))

  it("setFullscreen reports support 'none' where the browser allows no element fullscreen", async () => {
    const result = await onWebPage((hosting) => hosting.setFullscreen(true), { fullscreenEnabled: false })
    expect(result).toEqual({ ok: true, value: { fullscreen: false, support: 'none' } })
  })

  it('setFullscreen is refused DENIED when the browser refuses the request', async () => {
    const result = await onWebPage((hosting) => hosting.setFullscreen(true), { fullscreenRequest: 'refuse' })
    expect(result).toMatchObject({ ok: false, reason: { code: 'DENIED', operation: 'display.fullscreen' } })
  })

  it("keeps saves in localStorage under the SDK's ruken:<gameId>: prefix, beside other games' keys", () =>
    onWebPage(async (hosting, fake) => {
      fake.stored.set('ruken:other-game:progress', '9')
      unwrap(await hosting.saves.set('progress', '2'))
      expect(fake.stored.get('ruken:blank-game:progress')).toBe('2')
      expect(fake.stored.get('ruken:other-game:progress')).toBe('9')
    }))

  it("lists only this game's keys, without the prefix, the probe's key or another game's keys", () =>
    onWebPage(async (hosting, fake) => {
      fake.stored.set('ruken:other-game:progress', '9')
      fake.stored.set('theme', 'dark')
      unwrap(await hosting.saves.set('b', '1'))
      unwrap(await hosting.saves.set('a', '2'))
      expect(unwrap(await hosting.saves.keys())).toEqual(['a', 'b'])
    }))

  it('never reports a change to saves: one browser, one writer (Ruken: another device)', () =>
    onWebPage(async (hosting, fake) => {
      const changes: unknown[] = []
      hosting.saves.changed.subscribe((change) => changes.push(change))
      await delivered()
      fake.stored.set('ruken:blank-game:progress', '9') // a write from outside this session
      unwrap(await hosting.saves.set('progress', '4'))
      await delivered()
      expect(changes).toEqual([])
    }))

  it("probes storage with its own key, never the SDK's ruken:__probe__", () =>
    onWebPage((_hosting, fake) => {
      expect(fake.writes).toEqual([WEB_STORAGE_PROBE_KEY])
      expect(WEB_STORAGE_PROBE_KEY).not.toBe('ruken:__probe__')
      expect(fake.stored.size).toBe(0)
    }))

  it('warns when track() drops an undisclosed event, as the Ruken adapter does', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      const { hosting } = webHosting({}, 'web', { ...OPTIONS, disclosedEvents: ['race_started'] })
      hosting.track('race_started')
      hosting.track('not_disclosed')
      hosting.dispose()
      const said = warn.mock.calls.flat().join(' ')
      expect(said).toContain('not_disclosed')
      expect(said).not.toContain('race_started')
    } finally {
      warn.mockRestore()
    }
  })

  it('stops hearing the page once Hosting is disposed', async () => {
    const { fake, hosting } = webHosting()
    const { values } = record(hosting.lifecycle)
    hosting.dispose()
    fake.setVisibility('hidden')
    await delivered()
    expect(values).toEqual([{ state: 'active', reasons: [] }])
  })
})

// PUB-a: each intended difference from the Ruken adapter, pinned by a test named after it (PUB spec §3.1, §12).
describe('the web adapter: intended differences from the Ruken adapter', () => {
  it('exit is refused UNSUPPORTED and is not granted (Ruken standalone: exit does nothing)', async () => {
    const { granted, result } = await onWebPage(async (hosting) => ({
      granted: hosting.granted.has('exit'),
      result: await hosting.exit(),
    }))
    expect(granted).toBe(false)
    expect(result).toMatchObject({
      ok: false,
      reason: { code: 'UNSUPPORTED', retryable: false, operation: 'session.exit' },
    })
  })

  it('blocked storage probe: saves are not granted and every call is refused DENIED (Ruken standalone: memory)', () =>
    onWebPage(
      async (hosting, fake) => {
        expect(hosting.granted.has('saves')).toBe(false)
        for (const attempt of [
          hosting.saves.set('progress', '2'),
          hosting.saves.get('progress'),
          hosting.saves.remove('progress'),
          hosting.saves.flush(),
        ]) {
          expect(await attempt).toMatchObject({ ok: false, reason: { code: 'DENIED', retryable: false } })
        }
        // Nothing was kept anywhere, so nothing can be silently lost later.
        expect(fake.writes).toEqual([])
      },
      { storage: 'blocked' },
    ))

  it('QUOTA_EXCEEDED when the origin quota is full (itch.io games share one origin), keeping the old value', () =>
    onWebPage(
      async (hosting) => {
        unwrap(await hosting.saves.set('progress', 'small'))
        expect(await hosting.saves.set('progress', 'x'.repeat(200))).toMatchObject({
          ok: false,
          reason: { code: 'QUOTA_EXCEEDED', retryable: false, operation: 'saves.set' },
        })
        expect(unwrap(await hosting.saves.get('progress'))).toBe('small')
      },
      { quotaBytes: 100 },
    ))

  it("flush answers 'device': the saves are in this browser's storage, not a host's outbox (DIST-D3)", () =>
    onWebPage(async (hosting) => {
      unwrap(await hosting.saves.set('progress', 'level-2'))
      expect(unwrap(await hosting.saves.flush())).toEqual({ persisted: 'device' })
    }))

  it('no handshake wait: Hosting is built and ready at once (Ruken in a frame: up to 10 s)', async () => {
    const { hosting } = webHosting()
    // Built synchronously, and `ready` is already settled: a microtask is all it takes to read it.
    expect(await hosting.ready).toEqual({ ok: true, value: undefined })
    hosting.dispose()
  })

  it("no AF copy of Ruken's save limits: the browser's quota is the only limit (spec §9 request 4)", () =>
    // The Ruken SDK refuses a key outside its pattern (INVALID_PAYLOAD) and a value over its per-save size.
    // AF may not copy those limits (AGENTS.md "Ruken first"), and the SDK does not export them, so the web
    // adapter leaves them to Ruken until Ruken publishes them for other hosts.
    onWebPage(async (hosting) => {
      unwrap(await hosting.saves.set('not a valid key!', '1'))
      expect(unwrap(await hosting.saves.get('not a valid key!'))).toBe('1')
    }))
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
