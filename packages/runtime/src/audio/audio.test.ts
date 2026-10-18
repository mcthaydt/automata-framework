import { Hosting } from '@mcthaydt/automata-host'
import { FakeHostHandle, HostingTest, runScoped } from '@mcthaydt/automata-host/testing'
import { settle } from '@ruken/sdk-host/testing'
import { Deferred, Effect, Exit, Scope, SubscriptionRef } from 'effect'
import { describe, expect, it } from 'vitest'
import { AssetLoadFailed } from '../boot/boot-error.js'
import { makePresentationBus, type RuntimeFacts } from '../presentation/presentation-bus.manager.js'
import { type AudioServices, makeAudio } from './audio.manager.js'
import { AudioDecodeFailed } from './audio-error.js'
import type { AudioContextLike } from './audio-graph.js'
import { type FakeAudioContext, type FakeGainNode, fakeAudioContext } from './testing/fake-audio-context.js'

// The Audio service (M5 spec §4.6, §5, §6; A-a to A-c). The unlock, sleep and host-gain rules come from FloorFifty
// `managers/audio/engine.ts` and `ui/sleep-when-hidden.ts` at `ac72660`, and its tests `audio.test.ts` and
// `ruken/audio-host-gain.test.ts`; the host is `@ruken/sdk-host`'s fake host behind the real SDK (HostingTest).

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

const flush = () => Effect.promise(() => settle())

/** Drives the fake host, then lets the SDK's messages land (the bridge's calls return nothing to await). */
const drive = (step: () => unknown) =>
  Effect.promise(async () => {
    await step()
    await settle()
  })

interface Harness {
  readonly contexts: FakeAudioContext[]
  readonly facts: Array<{ readonly name: string; readonly fact: unknown }>
  readonly page: ReturnType<typeof page>
}

/** Builds the service over HostingTest and waits for the session to be ready. */
const withAudio = (
  body: (
    audio: Effect.Effect.Success<ReturnType<typeof makeAudio>>,
    harness: Harness,
  ) => Effect.Effect<void, unknown, Hosting | FakeHostHandle>,
  options: {
    readonly createContext?: () => AudioContextLike
    readonly muteUnfocused?: boolean
    readonly fetch?: typeof fetch
    readonly assets?: readonly string[]
  } = {},
) =>
  runScoped(
    Effect.gen(function* () {
      const hosting = yield* Hosting
      yield* hosting.ready
      const bus = yield* makePresentationBus()
      const contexts: FakeAudioContext[] = []
      const facts: Harness['facts'] = []
      for (const name of ['audio.unlocked', 'audio.unavailable', 'audio.decode.failed'] as const)
        bus.subscribe(name, (fact) => facts.push({ name, fact }))
      const at = page()
      const audio = yield* makeAudio({
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
      yield* flush()
      yield* body(audio, { contexts, facts, page: at })
    }).pipe(Effect.provide(HostingTest())),
  )

const masterOf = (audio: { input(bus: 'master'): AudioNode }) =>
  (audio.input('master') as unknown as FakeGainNode).gain.value

describe('Audio: unlock (A-a)', () => {
  it('builds no context before a gesture, then exactly one, running, on the first', () =>
    withAudio((audio, { contexts, facts, page }) =>
      Effect.gen(function* () {
        expect(contexts).toHaveLength(0)
        expect(yield* audio.unlocked.get).toBe(false)
        page.gesture('pointerdown')
        expect(contexts).toHaveLength(1)
        expect(contexts[0]?.resumed).toBe(1) // resume was called inside the gesture, before any await
        yield* flush()
        expect(contexts[0]?.state).toBe('running')
        expect(yield* audio.unlocked.get).toBe(true)
        page.gesture('keydown')
        page.gesture('touchend')
        expect(contexts).toHaveLength(1)
        expect(facts.filter((fact) => fact.name === 'audio.unlocked')).toHaveLength(1)
      }),
    ))

  it('unlocks on a key or a touch as well', async () => {
    for (const type of ['keydown', 'touchend']) {
      await withAudio((audio, { contexts, page }) =>
        Effect.gen(function* () {
          page.gesture(type)
          yield* flush()
          expect(contexts).toHaveLength(1)
          expect(yield* audio.unlocked.get).toBe(true)
        }),
      )
    }
  })

  it('ignores gestures before the session is ready', () =>
    runScoped(
      Effect.gen(function* () {
        const ready = yield* Deferred.make<void>()
        const hosting = {
          ready: Deferred.await(ready),
          lifecycle: yield* SubscriptionRef.make({ state: 'active' as const, reasons: [] }),
          audio: yield* SubscriptionRef.make({
            focus: 'full',
            master: { volume: 1, muted: false },
            gain: 1,
          } as never),
        }
        const bus = yield* makePresentationBus()
        const at = page()
        let built = 0
        yield* makeAudio({
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
        yield* Deferred.succeed(ready, undefined)
        yield* flush()
        at.gesture()
        expect(built).toBe(1)
      }),
    ))

  it('drops a sound before the unlock, and starts music asked for before it once unlocked', () =>
    withAudio((audio, { contexts, page }) =>
      Effect.gen(function* () {
        audio.sound('chime.wav')
        yield* audio.music('menu.ogg', { loop: { start: 1, end: 4 } })
        expect(contexts).toHaveLength(0)
        page.gesture()
        yield* flush()
        expect(contexts[0]?.started).toEqual([
          expect.objectContaining({ alias: 'menu.ogg', loop: true, loopStart: 1, loopEnd: 4 }),
        ])
      }),
    ))
})

describe('Audio: host gain (A-b)', () => {
  it("follows the host's volume and its ad, with no call from the game", () =>
    withAudio((audio, { page }) =>
      Effect.gen(function* () {
        const { host } = yield* FakeHostHandle
        page.gesture()
        yield* flush()
        audio.setGain('master', 0.5)
        expect(masterOf(audio)).toBeCloseTo(0.5)
        yield* drive(() => host.bridge.setMasterAudio(0.5, false))
        expect(masterOf(audio)).toBeCloseTo(0.25)
        yield* drive(() => host.bridge.setOverlay('ad'))
        expect(masterOf(audio)).toBe(0)
        yield* drive(() => host.bridge.setOverlay('none'))
        expect(masterOf(audio)).toBeCloseTo(0.25)
      }),
    ))

  it('mutes the master and restores the mix as it was', () =>
    withAudio((audio, { page }) =>
      Effect.gen(function* () {
        page.gesture()
        yield* flush()
        audio.setGain('master', 0.8)
        audio.setMuted(true)
        expect(masterOf(audio)).toBe(0)
        audio.setMuted(false)
        expect(masterOf(audio)).toBeCloseTo(0.8)
      }),
    ))
})

describe('Audio: sleep and wake (A-c)', () => {
  it('suspends a running context on a hidden page, dropping queued sounds, and resumes it when visible', () =>
    withAudio((audio, { contexts, page }) =>
      Effect.gen(function* () {
        page.gesture()
        yield* flush()
        audio.sound('chime.wav') // still decoding when the page hides
        page.show('hidden')
        yield* flush()
        expect(contexts[0]?.state).toBe('suspended')
        expect(contexts[0]?.started).toEqual([])
        page.show('visible')
        yield* flush()
        expect(contexts[0]?.state).toBe('running')
        expect(contexts[0]?.started).toEqual([])
      }),
    ))

  it("sleeps on the host's background for a hidden page, but not for its drawer", () =>
    withAudio((_audio, { contexts, page }) =>
      Effect.gen(function* () {
        const { host } = yield* FakeHostHandle
        page.gesture()
        yield* flush()
        yield* drive(() => host.bridge.setOverlay('drawer'))
        expect(contexts[0]?.state).toBe('running')
        yield* drive(() => host.bridge.setOverlay('none'))
        yield* drive(() => host.frame?.hostDocument.setVisibility('hidden'))
        expect(contexts[0]?.state).toBe('suspended')
        yield* drive(() => host.frame?.hostDocument.setVisibility('visible'))
        expect(contexts[0]?.state).toBe('running')
      }),
    ))

  it('builds nothing when the page hides and shows before an unlock', () =>
    withAudio((_audio, { contexts, page }) =>
      Effect.gen(function* () {
        page.show('hidden')
        page.show('visible')
        yield* flush()
        expect(contexts).toHaveLength(0)
      }),
    ))
})

describe('Audio: mute when unfocused', () => {
  it('silences the master while the window is blurred, and the graph keeps running', () =>
    withAudio(
      (audio, { contexts, page }) =>
        Effect.gen(function* () {
          page.gesture()
          yield* flush()
          page.window.dispatchEvent(new Event('blur'))
          expect(masterOf(audio)).toBe(0)
          expect(contexts[0]?.state).toBe('running')
          page.window.dispatchEvent(new Event('focus'))
          expect(masterOf(audio)).toBe(1)
        }),
      { muteUnfocused: true },
    ))

  it('keeps sound on a blurred window unless asked', () =>
    withAudio((audio, { page }) =>
      Effect.gen(function* () {
        page.gesture()
        yield* flush()
        page.window.dispatchEvent(new Event('blur'))
        expect(masterOf(audio)).toBe(1)
      }),
    ))
})

describe('Audio: available (M5.4)', () => {
  it('is available until a context fails to build, and stays so once one runs', () =>
    withAudio((audio, { page }) =>
      Effect.gen(function* () {
        expect(yield* audio.available.get).toBe(true)
        page.gesture()
        yield* flush()
        expect(yield* audio.available.get).toBe(true)
      }),
    ))
})

describe('Audio: mute when unfocused, as a live setting (M5.4)', () => {
  it('follows setMuteUnfocused: on, a blur silences the master and focus restores it; off, a blur does nothing', () =>
    withAudio((audio, { page }) =>
      Effect.gen(function* () {
        page.gesture()
        yield* flush()
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
      }),
    ))
})

describe('Audio: sounds, music and decoding', () => {
  it('plays a preloaded sound on sfx by default, decoding each alias once', () =>
    withAudio((audio, { contexts, page }) =>
      Effect.gen(function* () {
        page.gesture()
        yield* flush()
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
        yield* flush()
        expect(contexts[0]?.started.map((started) => started.alias)).toEqual(['chime.wav', 'chime.wav'])
        const [first, second] = (contexts[0]?.started ?? []).map((started) => started.target as FakeGainNode)
        expect(first?.targets).toEqual([audio.input('sfx')])
        expect(second?.targets).toEqual([audio.input('ui')])
        expect(decodes).toBe(1)
      }),
    ))

  const builtContexts: FakeAudioContext[] = []
  it('publishes audio.decode.failed for bytes that are not audio, and plays nothing', () =>
    withAudio(
      (audio, { facts, page }) =>
        Effect.gen(function* () {
          page.gesture()
          yield* flush()
          audio.sound('chime.wav')
          yield* flush()
          expect(builtContexts[0]?.started).toEqual([])
          expect(facts.filter((fact) => fact.name === 'audio.decode.failed')).toEqual([
            { name: 'audio.decode.failed', fact: expect.objectContaining({ alias: 'chime.wav' }) },
          ])
          const failed = yield* Effect.flip(audio.music('chime.wav'))
          expect(failed).toBeInstanceOf(AudioDecodeFailed)
        }),
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
      (audio, { contexts, page }) =>
        Effect.gen(function* () {
          page.gesture()
          yield* flush()
          yield* audio.music('loose.ogg')
          expect(contexts[0]?.started.map((started) => started.alias)).toEqual(['loose.ogg'])
          const failed = yield* Effect.flip(audio.music('missing.ogg'))
          expect(failed).toEqual(new AssetLoadFailed({ url: 'missing.ogg', status: 404 }))
        }),
      {
        assets: [],
        fetch: (async (url: string) =>
          url === 'loose.ogg'
            ? new Response(url)
            : new Response('', { status: 404 })) as unknown as typeof fetch,
      },
    ))

  it('ducks a bus and stops the music with a fade', () =>
    withAudio((audio, { contexts, page }) =>
      Effect.gen(function* () {
        page.gesture()
        yield* flush()
        yield* audio.music('menu.ogg')
        audio.duck('music', 0.5, 1)
        const duck = (audio.input('music') as unknown as FakeGainNode).targets[0] as FakeGainNode
        expect(duck.automation.find((step) => step.method === 'setTargetAtTime')?.value).toBe(0.5)
        audio.stopMusic(0.25)
        expect(contexts[0]?.stopped).toEqual([{ alias: 'menu.ogg', when: 0.25 }])
      }),
    ))
})

describe('Audio: failure and disposal', () => {
  it('publishes audio.unavailable when no context can be built, and the game runs silent (§6)', () =>
    withAudio(
      (audio, { facts, page }) =>
        Effect.gen(function* () {
          page.gesture()
          yield* flush()
          expect(facts).toEqual([{ name: 'audio.unavailable', fact: { reason: 'no Web Audio here' } }])
          // Kept as state too, so a Settings screen opened later still shows sound as unavailable (A-e, M5.4).
          expect(yield* audio.available.get).toBe(false)
          audio.sound('chime.wav')
          yield* audio.music('menu.ogg')
          page.gesture()
          expect(facts).toHaveLength(1)
          expect(yield* audio.unlocked.get).toBe(false)
        }),
      {
        createContext: () => {
          throw new Error('no Web Audio here')
        },
      },
    ))

  it('closes the context and stops listening when its scope closes', () =>
    runScoped(
      Effect.gen(function* () {
        const hosting = yield* Hosting
        yield* hosting.ready
        const bus = yield* makePresentationBus()
        const at = page()
        const contexts: FakeAudioContext[] = []
        const scope = yield* Scope.make()
        yield* makeAudio({
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
        }).pipe(Scope.extend(scope))
        yield* flush()
        at.gesture()
        yield* flush()
        yield* Scope.close(scope, Exit.void)
        expect(contexts[0]?.closed).toBe(true)
        at.show('hidden')
        at.gesture()
        expect(contexts).toHaveLength(1)
      }).pipe(Effect.provide(HostingTest())),
    ))

  it('throws a readable error from AudioBuses.input before the unlock', () =>
    withAudio((audio) =>
      Effect.sync(() => {
        expect(() => audio.input('sfx')).toThrow(/not unlocked/)
      }),
    ))
})

// Keeps the fact names in step with RuntimeFacts: a rename there fails to compile here.
const _factNames: ReadonlyArray<keyof RuntimeFacts> = [
  'audio.unlocked',
  'audio.unavailable',
  'audio.decode.failed',
]
void _factNames
