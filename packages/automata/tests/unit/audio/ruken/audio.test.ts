import type { FakeHost } from '@ruken/sdk-host/testing'
import { settle } from '@ruken/sdk-host/testing'
import { describe, expect, it } from 'vitest'
import { type Audio, type AudioServices, createAudio } from '#src/features/audio/audio.manager.ts'
import type { AudioBuses } from '#src/features/audio/audio-buses.ts'
import { AudioDecodeFailed } from '#src/features/audio/audio-error.ts'
import type { AudioContextLike } from '#src/features/audio/audio-graph.ts'
import {
  type FakeAudioContext,
  type FakeGainNode,
  fakeAudioContext,
} from '#src/features/audio/testing/fake-audio-context.ts'
import { state } from '#src/shared/lib/subscribable.ts'
import { AssetLoadFailed } from '#src/shared/runtime/boot-error.ts'
import {
  createPresentationBus,
  type RuntimeFacts,
} from '#src/shared/runtime/presentation/presentation-bus.manager.ts'
import { withHostingTest } from '#src/testing/host/page/ruken/hosting-test.ts'

// The Audio service (M5 spec §4.6, §5, §6; A-a to A-c). The unlock, sleep and host-gain rules are the audio engine's, with the host's gain and
// lifecycle applied; the host is `@ruken/sdk-host`'s fake host behind the real SDK (withHostingTest).

/** A page: gestures and focus land on `window`, visibility on `document`. */
function page() {
  const window = new EventTarget()
  const document = Object.assign(new EventTarget(), { visibilityState: 'visible' as DocumentVisibilityState })
  return {
    window,
    document,
    gesture: (type = 'pointerdown') => window.dispatchEvent(new Event(type)),
    show: (state: DocumentVisibilityState) => {
      document.visibilityState = state
      document.dispatchEvent(new Event('visibilitychange'))
    },
  }
}

/** Blobs by path, standing in for the screens' preloaded assets; each blob's text is its alias. */
const assetsOf = (paths: readonly string[]) => ({
  get: (path: string) => (paths.includes(path) ? new Blob([path]) : undefined),
})

/** Drives the fake host, then lets the SDK's messages land (the bridge's calls return nothing to await). */
const drive = async (step: () => unknown) => {
  await step()
  await settle()
}

interface Harness {
  readonly contexts: FakeAudioContext[]
  readonly facts: Array<{ readonly name: string; readonly fact: unknown }>
  readonly page: ReturnType<typeof page>
  readonly host: FakeHost
}

/** Builds the service over the fake host, waits for the session to be ready, and disposes both afterwards. */
const withAudio = (
  body: (audio: Audio & AudioBuses, harness: Harness) => void | Promise<void>,
  options: {
    readonly createContext?: () => AudioContextLike
    readonly muteUnfocused?: boolean
    readonly fetch?: typeof fetch
    readonly assets?: readonly string[]
  } = {},
) =>
  withHostingTest(async ({ hosting, handle }) => {
    await hosting.ready
    const bus = createPresentationBus()
    const contexts: FakeAudioContext[] = []
    const facts: Harness['facts'] = []
    for (const name of ['audio.unlocked', 'audio.unavailable', 'audio.decode.failed'] as const)
      bus.subscribe(name, (fact) => facts.push({ name, fact }))
    const at = page()
    const audio = createAudio({
      hosting,
      bus,
      assets: assetsOf(options.assets ?? ['chime.wav', 'menu.ogg']),
      window: at.window,
      document: at.document,
      createContext:
        options.createContext ??
        (() => {
          const context = fakeAudioContext()
          contexts.push(context)
          return context
        }),
      ...(options.muteUnfocused === undefined ? {} : { muteUnfocused: options.muteUnfocused }),
      ...(options.fetch === undefined ? {} : { fetch: options.fetch }),
    })
    try {
      await settle()
      await body(audio, { contexts, facts, page: at, host: handle.host })
    } finally {
      audio.dispose()
      bus.dispose()
    }
  })

const masterOf = (audio: { input(bus: 'master'): AudioNode }) =>
  (audio.input('master') as unknown as FakeGainNode).gain.value

describe('Audio: unlock (A-a)', () => {
  it('builds no context before a gesture, then exactly one, running, on the first', () =>
    withAudio(async (audio, { contexts, facts, page }) => {
      expect(contexts).toHaveLength(0)
      expect(audio.unlocked.get()).toBe(false)
      page.gesture('pointerdown')
      expect(contexts).toHaveLength(1)
      expect(contexts[0]?.resumed).toBe(1) // resume was called inside the gesture, before any await
      await settle()
      expect(contexts[0]?.state).toBe('running')
      expect(audio.unlocked.get()).toBe(true)
      page.gesture('keydown')
      page.gesture('touchend')
      expect(contexts).toHaveLength(1)
      expect(facts.filter((fact) => fact.name === 'audio.unlocked')).toHaveLength(1)
    }))

  it('unlocks on a key or a touch as well', async () => {
    for (const type of ['keydown', 'touchend']) {
      await withAudio(async (audio, { contexts, page }) => {
        page.gesture(type)
        await settle()
        expect(contexts).toHaveLength(1)
        expect(audio.unlocked.get()).toBe(true)
      })
    }
  })

  it('ignores gestures before the session is ready', async () => {
    let resolveReady: (result: { ok: true; value: undefined }) => void = () => undefined
    const hosting = {
      ready: new Promise<{ ok: true; value: undefined }>((resolve) => (resolveReady = resolve)),
      lifecycle: state({ state: 'active' as const, reasons: [] }),
      audio: state({ focus: 'full', master: { volume: 1, muted: false }, gain: 1 } as never),
    }
    const bus = createPresentationBus()
    const at = page()
    let built = 0
    const audio = createAudio({
      hosting: hosting as unknown as AudioServices['hosting'],
      bus,
      assets: assetsOf([]),
      window: at.window,
      document: at.document,
      createContext: () => {
        built += 1
        return fakeAudioContext()
      },
    })
    at.gesture()
    expect(built).toBe(0)
    resolveReady({ ok: true, value: undefined })
    await settle()
    at.gesture()
    expect(built).toBe(1)
    audio.dispose()
  })

  it('drops a sound before the unlock, and starts music asked for before it once unlocked', () =>
    withAudio(async (audio, { contexts, page }) => {
      audio.sound('chime.wav')
      await audio.music('menu.ogg', { loop: { start: 1, end: 4 } })
      expect(contexts).toHaveLength(0)
      page.gesture()
      await settle()
      expect(contexts[0]?.started).toEqual([
        expect.objectContaining({ alias: 'menu.ogg', loop: true, loopStart: 1, loopEnd: 4 }),
      ])
    }))
})

describe('Audio: host gain (A-b)', () => {
  it("follows the host's volume and its ad, with no call from the game", () =>
    withAudio(async (audio, { page, host }) => {
      page.gesture()
      await settle()
      audio.setGain('master', 0.5)
      expect(masterOf(audio)).toBeCloseTo(0.5)
      await drive(() => host.bridge.setMasterAudio(0.5, false))
      expect(masterOf(audio)).toBeCloseTo(0.25)
      await drive(() => host.bridge.setOverlay('ad'))
      expect(masterOf(audio)).toBe(0)
      await drive(() => host.bridge.setOverlay('none'))
      expect(masterOf(audio)).toBeCloseTo(0.25)
    }))

  it('mutes the master and restores the mix as it was', () =>
    withAudio(async (audio, { page }) => {
      page.gesture()
      await settle()
      audio.setGain('master', 0.8)
      audio.setMuted(true)
      expect(masterOf(audio)).toBe(0)
      audio.setMuted(false)
      expect(masterOf(audio)).toBeCloseTo(0.8)
    }))
})

describe('Audio: sleep and wake (A-c)', () => {
  it('suspends a running context on a hidden page, dropping queued sounds, and resumes it when visible', () =>
    withAudio(async (audio, { contexts, page }) => {
      page.gesture()
      await settle()
      audio.sound('chime.wav') // still decoding when the page hides
      page.show('hidden')
      await settle()
      expect(contexts[0]?.state).toBe('suspended')
      expect(contexts[0]?.started).toEqual([])
      page.show('visible')
      await settle()
      expect(contexts[0]?.state).toBe('running')
      expect(contexts[0]?.started).toEqual([])
    }))

  it("sleeps on the host's background for a hidden page, but not for its drawer", () =>
    withAudio(async (_audio, { contexts, page, host }) => {
      page.gesture()
      await settle()
      await drive(() => host.bridge.setOverlay('drawer'))
      expect(contexts[0]?.state).toBe('running')
      await drive(() => host.bridge.setOverlay('none'))
      await drive(() => host.frame?.hostDocument.setVisibility('hidden'))
      expect(contexts[0]?.state).toBe('suspended')
      await drive(() => host.frame?.hostDocument.setVisibility('visible'))
      expect(contexts[0]?.state).toBe('running')
    }))

  it('builds nothing when the page hides and shows before an unlock', () =>
    withAudio(async (_audio, { contexts, page }) => {
      page.show('hidden')
      page.show('visible')
      await settle()
      expect(contexts).toHaveLength(0)
    }))
})

describe('Audio: mute when unfocused', () => {
  it('silences the master while the window is blurred, and the graph keeps running', () =>
    withAudio(
      async (audio, { contexts, page }) => {
        page.gesture()
        await settle()
        page.window.dispatchEvent(new Event('blur'))
        expect(masterOf(audio)).toBe(0)
        expect(contexts[0]?.state).toBe('running')
        page.window.dispatchEvent(new Event('focus'))
        expect(masterOf(audio)).toBe(1)
      },
      { muteUnfocused: true },
    ))

  it('keeps sound on a blurred window unless asked', () =>
    withAudio(async (audio, { page }) => {
      page.gesture()
      await settle()
      page.window.dispatchEvent(new Event('blur'))
      expect(masterOf(audio)).toBe(1)
    }))
})

describe('Audio: a sample on a volume’s release (redo step 11)', () => {
  it('plays a short tone the graph makes, on the bus asked for, once unlocked', () =>
    withAudio(async (audio, { contexts, page }) => {
      audio.sample('music')
      expect(contexts).toHaveLength(0)
      page.gesture()
      await settle()
      audio.sample('music')
      await settle()
      const started = contexts[0]?.started.at(-1)
      expect(started?.alias).toBe('tone')
      const level = started?.target as { targets: unknown[] } | undefined
      expect(level?.targets).toEqual([audio.input('music')])
    }))
})

describe('Audio: available (M5.4)', () => {
  it('is available until a context fails to build, and stays so once one runs', () =>
    withAudio(async (audio, { page }) => {
      expect(audio.available.get()).toBe(true)
      page.gesture()
      await settle()
      expect(audio.available.get()).toBe(true)
    }))
})

describe('Audio: mute when unfocused, as a live setting (M5.4)', () => {
  it('follows setMuteUnfocused: on, a blur silences the master and focus restores it; off, a blur does nothing', () =>
    withAudio(async (audio, { page }) => {
      page.gesture()
      await settle()
      audio.setMuteUnfocused(true)
      page.window.dispatchEvent(new Event('blur'))
      expect(masterOf(audio)).toBe(0)
      page.window.dispatchEvent(new Event('focus'))
      expect(masterOf(audio)).toBe(1)
      page.window.dispatchEvent(new Event('blur'))
      audio.setMuteUnfocused(false)
      expect(masterOf(audio)).toBe(1)
      page.window.dispatchEvent(new Event('blur'))
      expect(masterOf(audio)).toBe(1)
    }))
})

describe('Audio: sounds, music and decoding', () => {
  it('plays a preloaded sound on sfx by default, decoding each alias once', () =>
    withAudio(async (audio, { contexts, page }) => {
      page.gesture()
      await settle()
      let decodes = 0
      const decode = contexts[0]?.decodeAudioData.bind(contexts[0])
      Object.assign(contexts[0] ?? {}, {
        decodeAudioData: (bytes: ArrayBuffer) => {
          decodes += 1
          return decode?.(bytes)
        },
      })
      audio.sound('chime.wav')
      audio.sound('chime.wav', { bus: 'ui', gain: 0.5 })
      await settle()
      expect(contexts[0]?.started.map((started) => started.alias)).toEqual(['chime.wav', 'chime.wav'])
      const [first, second] = (contexts[0]?.started ?? []).map((started) => started.target as FakeGainNode)
      expect(first?.targets).toEqual([audio.input('sfx')])
      expect(second?.targets).toEqual([audio.input('ui')])
      expect(decodes).toBe(1)
    }))

  const builtContexts: FakeAudioContext[] = []
  it('publishes audio.decode.failed for bytes that are not audio, and plays nothing', () =>
    withAudio(
      async (audio, { facts, page }) => {
        page.gesture()
        await settle()
        audio.sound('chime.wav')
        await settle()
        expect(builtContexts[0]?.started).toEqual([])
        expect(facts.filter((fact) => fact.name === 'audio.decode.failed')).toEqual([
          { name: 'audio.decode.failed', fact: expect.objectContaining({ alias: 'chime.wav' }) },
        ])
        const failed = await audio.music('chime.wav')
        expect(failed.ok ? undefined : failed.reason).toBeInstanceOf(AudioDecodeFailed)
      },
      {
        createContext: () => {
          const context = fakeAudioContext(() => {
            throw new Error('EncodingError')
          })
          builtContexts.push(context)
          return context
        },
      },
    ))

  it('fetches a file no screen preloaded, and fails with AssetLoadFailed when it is not there', () =>
    withAudio(
      async (audio, { contexts, page }) => {
        page.gesture()
        await settle()
        await audio.music('loose.ogg')
        expect(contexts[0]?.started.map((started) => started.alias)).toEqual(['loose.ogg'])
        const failed = await audio.music('missing.ogg')
        expect(failed.ok ? undefined : failed.reason).toEqual(
          new AssetLoadFailed({ url: 'missing.ogg', status: 404 }),
        )
      },
      {
        assets: [],
        fetch: (async (url: string) =>
          url === 'loose.ogg'
            ? new Response(url)
            : new Response('', { status: 404 })) as unknown as typeof fetch,
      },
    ))

  it('ducks a bus and stops the music with a fade', () =>
    withAudio(async (audio, { contexts, page }) => {
      page.gesture()
      await settle()
      await audio.music('menu.ogg')
      audio.duck('music', 0.5, 1)
      const duck = (audio.input('music') as unknown as FakeGainNode).targets[0] as FakeGainNode
      expect(duck.automation.find((step) => step.method === 'setTargetAtTime')?.value).toBe(0.5)
      audio.stopMusic(0.25)
      expect(contexts[0]?.stopped).toEqual([{ alias: 'menu.ogg', when: 0.25 }])
    }))
})

describe('Audio: failure and disposal', () => {
  it('publishes audio.unavailable when no context can be built, and the game runs silent (§6)', () =>
    withAudio(
      async (audio, { facts, page }) => {
        page.gesture()
        await settle()
        expect(facts).toEqual([{ name: 'audio.unavailable', fact: { reason: 'no Web Audio here' } }])
        // Kept as state too, so a Settings screen opened later still shows sound as unavailable (A-e, M5.4).
        expect(audio.available.get()).toBe(false)
        audio.sound('chime.wav')
        await audio.music('menu.ogg')
        page.gesture()
        expect(facts).toHaveLength(1)
        expect(audio.unlocked.get()).toBe(false)
      },
      {
        createContext: () => {
          throw new Error('no Web Audio here')
        },
      },
    ))

  it('closes the context and stops listening when it is disposed', () =>
    withHostingTest(async ({ hosting }) => {
      await hosting.ready
      const bus = createPresentationBus()
      const at = page()
      const contexts: FakeAudioContext[] = []
      const audio = createAudio({
        hosting,
        bus,
        assets: assetsOf([]),
        window: at.window,
        document: at.document,
        createContext: () => {
          const context = fakeAudioContext()
          contexts.push(context)
          return context
        },
      })
      await settle()
      at.gesture()
      await settle()
      audio.dispose()
      expect(contexts[0]?.closed).toBe(true)
      at.show('hidden')
      at.gesture()
      expect(contexts).toHaveLength(1)
    }))

  it('throws a readable error from AudioBuses.input before the unlock', () =>
    withAudio((audio) => {
      expect(() => audio.input('sfx')).toThrow(/not unlocked/)
    }))
})

// Keeps the fact names in step with RuntimeFacts: a rename there fails to compile here.
const _factNames: ReadonlyArray<keyof RuntimeFacts> = [
  'audio.unlocked',
  'audio.unavailable',
  'audio.decode.failed',
]
void _factNames
