import type { FlowGraph } from '@mcthaydt/automata-content'
import { contentHash } from '@mcthaydt/automata-content'
import { createFakeHost, type FakeHost, settle } from '@ruken/sdk-host/testing'
import { Effect, Exit, Fiber, Scope, TestClock, TestContext } from 'effect'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { bootProgram, contentHashOf } from '#src/app/boot/boot-program.ts'
import { Audio, AudioBuses, Saves, settingsStore } from '#src/app/boot/effect-tags.ts'
import type { CompiledContentData, GameDefinition } from '#src/app/boot/game-definition.ts'
import { CORE_SETTINGS, type CoreSettings } from '#src/app/core-settings.ts'
import type { ScreenDef } from '#src/app/flow/screen.ts'
import { type FakeAudioContext, fakeAudioContext } from '#src/features/audio/testing/fake-audio-context.ts'
import { createHaptics, Haptics } from '#src/features/input/haptics/haptics.manager.ts'
import { Leaderboards } from '#src/features/leaderboards/leaderboards.manager.ts'
import type { Save } from '#src/features/saves/save.manager.ts'
import { defineSave } from '#src/features/saves/save.schema.ts'
import { saveOf } from '#src/features/saves/saves.manager.ts'
import {
  AssetLoadFailed,
  BootDefect,
  ContentHashMismatch,
  LoadStalled,
  RendererUnavailable,
} from '#src/shared/runtime/boot-error.ts'
import { PresentationBus } from '#src/shared/runtime/presentation/presentation-bus.manager.ts'
import type { RenderTarget } from '#src/shared/runtime/render/renderer.ts'
import type { SettingsStore } from '#src/shared/runtime/settings/settings.manager.ts'
import { Time } from '#src/shared/runtime/time/time.manager.ts'
import { fakeFetch } from '#src/testing/runtime/fake-fetch.ts'
import { manualFrames } from '#src/testing/runtime/manual-frames.ts'
import { nullRenderer } from '#src/testing/runtime/null-renderer.ts'
import { HostError } from '../../../../../src/shared/host/errors.ts'
import type { Hosting } from '../../../../../src/shared/host/hosting.ts'
import { realClock } from '../../../../../src/testing/host/page/clocks.ts'
import { TEST_GAME_ORIGIN } from '../../../../../src/testing/host/page/ruken/hosting-test.ts'

const testFlow: FlowGraph = {
  entry: 'title',
  screens: ['paused', 'play', 'title'],
  terminal: [],
  transitions: [
    { from: 'title', event: 'start', to: 'play', transition: 'fade' },
    { from: 'play', event: 'pause', to: 'paused', transition: 'cut' },
    { from: 'paused', event: 'resume', to: 'play', transition: 'cut' },
  ],
}

const fixtureContentData: CompiledContentData = {
  flow: testFlow,
  game: {
    source_language: 'en',
    rating: 'everyone',
    descriptors: [],
    custom_events: ['level_completed', 'score_achieved'],
    preload_screens: ['title'],
  },
  assets: {
    screens: {
      title: { files: ['/assets/title.png'] },
      play: { files: ['/assets/play.png'] },
      paused: { files: [] },
    },
  },
}

function makeTestScreens() {
  const entered: string[] = []
  const menuCalls: string[] = []
  const screens: ScreenDef[] = [
    {
      id: 'title',
      enter: (ctx) =>
        Effect.sync(() => {
          entered.push('title')
          const el = document.createElement('div')
          el.setAttribute('data-testid', 'title-screen')
          el.textContent = 'Title Screen'
          ctx.layer.appendChild(el)
        }),
      openMenu: () => {
        menuCalls.push('title')
        return true
      },
    },
    {
      id: 'play',
      enter: (ctx) =>
        Effect.sync(() => {
          entered.push('play')
          const el = document.createElement('div')
          el.setAttribute('data-testid', 'play-screen')
          ctx.layer.appendChild(el)
        }),
      openMenu: () => {
        menuCalls.push('play')
        return true
      },
    },
    {
      id: 'paused',
      pausesSim: true,
      enter: (ctx) =>
        Effect.sync(() => {
          entered.push('paused')
          const el = document.createElement('div')
          el.setAttribute('data-testid', 'paused-screen')
          ctx.layer.appendChild(el)
        }),
      openMenu: () => {
        menuCalls.push('paused')
        return true
      },
    },
  ]
  return { screens, entered, menuCalls }
}

const advanceFirstFrame = (frames: ReturnType<typeof manualFrames>) =>
  Effect.gen(function* () {
    while (!frames.pending) {
      yield* Effect.yieldNow()
    }
    frames.advance(16)
    yield* Effect.promise(() => settle(2))
  })

describe('bootProgram', () => {
  it('contentHashOf matches contentHash from @mcthaydt/automata-content', () => {
    expect(contentHashOf(fixtureContentData)).toBe(contentHash(fixtureContentData))
  })

  it('step order: three layers exist, data-state="loading" and loader mounted before hello; ready unmounts loader, sets ready and enters entry screen', () =>
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const root = document.createElement('div')
      document.body.appendChild(root)
      Scope.addFinalizer(
        scope,
        Effect.sync(() => root.remove()),
      )

      const frames = manualFrames()
      const { screens, entered } = makeTestScreens()
      let fakeHostInstance: FakeHost | undefined

      const mockFetch = fakeFetch({
        '/assets/title.png': { chunks: [new Uint8Array([1, 2, 3])] },
      })

      const game: GameDefinition = {
        root,
        hosting: {
          gameId: 'test-game',
          wants: [],
          pauseBehavior: 'pause',
        },
        content: {
          data: fixtureContentData,
          hash: contentHashOf(fixtureContentData),
        },
        screens,
        renderer: nullRenderer(),
        seams: {
          fetch: mockFetch.fetch,
          frames,
          fonts: { load: () => Promise.resolve([]) },
          sdkEnv: () => {
            fakeHostInstance = createFakeHost({
              gameOrigin: TEST_GAME_ORIGIN,
              gameId: 'test-game',
              clock: realClock,
              autoReady: false,
            })
            return fakeHostInstance.gameEnv!
          },
        },
      }

      const fiber = yield* Effect.fork(bootProgram(game).pipe(Scope.extend(scope)))

      // Wait until frames.pending in Step 1 (before frame advance, before hello)
      while (!frames.pending) {
        yield* Effect.yieldNow()
      }

      // Step 1: layers exist, data-state is loading, loader overlay mounted
      expect(root.querySelector('[data-layer="stage"]')).not.toBeNull()
      expect(root.querySelector('[data-layer="screens"]')).not.toBeNull()
      expect(root.querySelector('[data-layer="overlay"]')).not.toBeNull()
      expect(document.documentElement.getAttribute('data-state')).toBe('loading')
      expect(root.querySelector('[data-testid="loader-overlay"]')).not.toBeNull()

      // Fake host has NOT been created yet or has not received hello
      expect(fakeHostInstance).toBeUndefined()

      // Advance one frame for afterFirstPaint -> proceeds to Step 2
      frames.advance(16)
      yield* Effect.promise(() => settle(2))

      // Fake host has now seen hello
      expect(fakeHostInstance).toBeDefined()
      const hellos = fakeHostInstance!.messages.filter((m) => m.dir === 'in' && m.msg.type === 'hello')
      expect(hellos.length).toBe(1)

      // While host has not said ready, nothing in screens layer and no screen entered
      const screensLayer = root.querySelector('[data-layer="screens"]')!
      expect(screensLayer.children.length).toBe(0)
      expect(entered.length).toBe(0)

      // Now host says ready
      yield* Effect.promise(() => fakeHostInstance!.bridge.markReady())
      yield* Effect.promise(() => settle(2))

      // Boot program finishes successfully
      yield* Fiber.join(fiber)

      // Loader is gone, state is ready, entry screen entered
      expect(root.querySelector('[data-testid="loader-overlay"]')).toBeNull()
      expect(document.documentElement.getAttribute('data-state')).toBe('ready')
      expect(entered).toEqual(['title'])
      expect(screensLayer.querySelector('[data-testid="title-screen"]')).not.toBeNull()

      yield* Scope.close(scope, Exit.void)
    }).pipe(Effect.runPromise))

  it('disclosedEvents come from content.game.custom_events', () =>
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const root = document.createElement('div')
      const frames = manualFrames()
      const { screens } = makeTestScreens()
      let fakeHostInstance: FakeHost | undefined
      let capturedHosting: Hosting | undefined

      const mockFetch = fakeFetch({
        '/assets/title.png': { chunks: [new Uint8Array([1, 2, 3])] },
      })

      const game: GameDefinition = {
        root,
        hosting: {
          gameId: 'test-game',
          wants: ['analytics.custom'],
          pauseBehavior: 'pause',
        },
        content: {
          data: fixtureContentData,
          hash: contentHashOf(fixtureContentData),
        },
        screens,
        renderer: nullRenderer(),
        seams: {
          fetch: mockFetch.fetch,
          frames,
          fonts: { load: () => Promise.resolve([]) },
          sdkEnv: () => {
            fakeHostInstance = createFakeHost({
              gameOrigin: TEST_GAME_ORIGIN,
              gameId: 'test-game',
              clock: realClock,
              consent: { analytics: true },
            })
            return fakeHostInstance.gameEnv!
          },
        },
      }

      const fiber = yield* Effect.fork(
        bootProgram(game, {
          onHosting: (h) => {
            capturedHosting = h
          },
        }).pipe(Scope.extend(scope)),
      )
      yield* advanceFirstFrame(frames)
      yield* Fiber.join(fiber)

      expect(capturedHosting).toBeDefined()
      // Disclosed event reaches the fake host
      yield* capturedHosting!.track('level_completed')
      yield* Effect.promise(() => settle(2))
      const sentCustom = fakeHostInstance!.messages.filter(
        (m) => m.dir === 'in' && m.msg.type === 'analytics.track',
      )
      expect(sentCustom.length).toBe(1)

      // Undisclosed event is dropped by Hosting
      yield* capturedHosting!.track('undisclosed_event')
      yield* Effect.promise(() => settle(2))
      const sentAfter = fakeHostInstance!.messages.filter(
        (m) => m.dir === 'in' && m.msg.type === 'analytics.track',
      )
      expect(sentAfter.length).toBe(1)

      yield* Scope.close(scope, Exit.void)
    }).pipe(Effect.runPromise))

  it("hands the renderer the runtime's presentation bus, so a dropped filter is a fact (M4 spec §6)", () =>
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const root = document.createElement('div')
      const frames = manualFrames()
      const heard: unknown[] = []
      let targetBus: RenderTarget['bus']
      const screens: ScreenDef[] = [
        {
          id: 'title',
          enter: () =>
            Effect.gen(function* () {
              const bus = yield* PresentationBus
              bus.subscribe('render.filter.dropped', (fact) => heard.push(fact))
            }),
        },
      ]
      const inner = nullRenderer()
      const game: GameDefinition = {
        root,
        hosting: { gameId: 'test-game', wants: [], pauseBehavior: 'pause' },
        content: { data: fixtureContentData, hash: contentHashOf(fixtureContentData) },
        screens,
        renderer: (target) => {
          targetBus = target.bus
          return inner(target)
        },
        seams: {
          fetch: fakeFetch({ '/assets/title.png': { chunks: [new Uint8Array([1, 2, 3])] } }).fetch,
          frames,
          fonts: { load: () => Promise.resolve([]) },
          sdkEnv: () =>
            createFakeHost({ gameOrigin: TEST_GAME_ORIGIN, gameId: 'test-game', clock: realClock }).gameEnv!,
        },
      }

      const fiber = yield* Effect.fork(bootProgram(game).pipe(Scope.extend(scope)))
      yield* advanceFirstFrame(frames)
      yield* Fiber.join(fiber)

      expect(targetBus).toBeDefined()
      targetBus?.publish('render.filter.dropped', { id: 'bloom', reason: 'compile failed' })
      expect(heard).toEqual([{ id: 'bloom', reason: 'compile failed' }])

      yield* Scope.close(scope, Exit.void)
    }).pipe(Effect.runPromise))

  it('fails with HostError{operation: "init"} on invalid testHostOrigins', () =>
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const root = document.createElement('div')
      const frames = manualFrames()
      const { screens } = makeTestScreens()

      const game: GameDefinition = {
        root,
        hosting: {
          gameId: 'test-game',
          wants: [],
          pauseBehavior: 'pause',
          testHostOrigins: ['not a valid url'],
        },
        content: {
          data: fixtureContentData,
          hash: contentHashOf(fixtureContentData),
        },
        screens,
        renderer: nullRenderer(),
        seams: {
          frames,
          fonts: { load: () => Promise.resolve([]) },
        },
      }

      const fiber = yield* Effect.fork(bootProgram(game).pipe(Scope.extend(scope)))
      yield* advanceFirstFrame(frames)
      const result = yield* Effect.flip(Fiber.join(fiber))

      expect(result).toBeInstanceOf(HostError)
      expect((result as HostError).operation).toBe('init')

      yield* Scope.close(scope, Exit.void)
    }).pipe(Effect.runPromise))

  it('fails with HostError{operation: "saves.get"} on rejected settings key', () =>
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const root = document.createElement('div')
      const frames = manualFrames()
      const { screens } = makeTestScreens()

      const game: GameDefinition<{ v: number }> = {
        root,
        hosting: {
          gameId: 'test-game',
          wants: ['saves'],
          pauseBehavior: 'pause',
        },
        content: {
          data: fixtureContentData,
          hash: contentHashOf(fixtureContentData),
        },
        screens,
        renderer: nullRenderer(),
        settings: {
          key: 'invalid key with spaces and special chars @#$',
          version: 1,
          schema: z.object({ v: z.number().catch(1) }),
          defaults: { v: 1 },
        },
        seams: {
          frames,
          fonts: { load: () => Promise.resolve([]) },
          sdkEnv: () => {
            const host = createFakeHost({
              gameOrigin: TEST_GAME_ORIGIN,
              gameId: 'test-game',
              clock: realClock,
            })
            return host.gameEnv!
          },
        },
      }

      const fiber = yield* Effect.fork(bootProgram(game).pipe(Scope.extend(scope)))
      yield* advanceFirstFrame(frames)
      const result = yield* Effect.flip(Fiber.join(fiber))

      expect(result).toBeInstanceOf(HostError)
      expect((result as HostError).operation).toBe('saves.get')

      yield* Scope.close(scope, Exit.void)
    }).pipe(Effect.runPromise))

  it('fails with ContentHashMismatch when content.hash is tampered', () =>
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const root = document.createElement('div')
      const frames = manualFrames()
      const { screens } = makeTestScreens()

      const game: GameDefinition = {
        root,
        hosting: {
          gameId: 'test-game',
          wants: [],
          pauseBehavior: 'pause',
        },
        content: {
          data: fixtureContentData,
          hash: '0000000000000000', // tampered hash
        },
        screens,
        renderer: nullRenderer(),
        seams: {
          frames,
          fonts: { load: () => Promise.resolve([]) },
          sdkEnv: () => {
            const host = createFakeHost({
              gameOrigin: TEST_GAME_ORIGIN,
              gameId: 'test-game',
              clock: realClock,
            })
            return host.gameEnv!
          },
        },
      }

      const fiber = yield* Effect.fork(bootProgram(game).pipe(Scope.extend(scope)))
      yield* advanceFirstFrame(frames)
      const result = yield* Effect.flip(Fiber.join(fiber))

      expect(result).toBeInstanceOf(ContentHashMismatch)
      const mismatch = result as ContentHashMismatch
      expect(mismatch.expected).toBe('0000000000000000')
      expect(mismatch.actual).toBe(contentHashOf(fixtureContentData))

      yield* Scope.close(scope, Exit.void)
    }).pipe(Effect.runPromise))

  it('fails with AssetLoadFailed on 404 preload file', () =>
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const root = document.createElement('div')
      const frames = manualFrames()
      const { screens } = makeTestScreens()

      // Empty routes -> 404
      const mockFetch = fakeFetch({})

      const game: GameDefinition = {
        root,
        hosting: {
          gameId: 'test-game',
          wants: [],
          pauseBehavior: 'pause',
        },
        content: {
          data: fixtureContentData,
          hash: contentHashOf(fixtureContentData),
        },
        screens,
        renderer: nullRenderer(),
        seams: {
          fetch: mockFetch.fetch,
          frames,
          fonts: { load: () => Promise.resolve([]) },
          sdkEnv: () => {
            const host = createFakeHost({
              gameOrigin: TEST_GAME_ORIGIN,
              gameId: 'test-game',
              clock: realClock,
            })
            return host.gameEnv!
          },
        },
      }

      const fiber = yield* Effect.fork(bootProgram(game).pipe(Scope.extend(scope)))
      yield* advanceFirstFrame(frames)
      const result = yield* Effect.flip(Fiber.join(fiber))

      expect(result).toBeInstanceOf(AssetLoadFailed)
      expect((result as AssetLoadFailed).status).toBe(404)

      yield* Scope.close(scope, Exit.void)
    }).pipe(Effect.runPromise))

  it('fails with LoadStalled on silent preload file after 30s', () =>
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const root = document.createElement('div')
      const frames = manualFrames()
      const { screens } = makeTestScreens()

      const mockFetch = fakeFetch({
        '/assets/title.png': { hang: true },
      })

      const game: GameDefinition = {
        root,
        hosting: {
          gameId: 'test-game',
          wants: [],
          pauseBehavior: 'pause',
        },
        content: {
          data: fixtureContentData,
          hash: contentHashOf(fixtureContentData),
        },
        screens,
        renderer: nullRenderer(),
        seams: {
          fetch: mockFetch.fetch,
          frames,
          fonts: { load: () => Promise.resolve([]) },
          sdkEnv: () => {
            const host = createFakeHost({
              gameOrigin: TEST_GAME_ORIGIN,
              gameId: 'test-game',
              clock: realClock,
            })
            return host.gameEnv!
          },
        },
      }

      const fiber = yield* Effect.fork(bootProgram(game).pipe(Scope.extend(scope)))
      yield* advanceFirstFrame(frames)

      // Advance 30 seconds on TestClock to trigger stall
      yield* TestClock.adjust('30 seconds')
      const result = yield* Effect.flip(Fiber.join(fiber))

      expect(result).toBeInstanceOf(LoadStalled)

      yield* Scope.close(scope, Exit.void)
    }).pipe(Effect.provide(TestContext.TestContext), Effect.runPromise))

  it('fails with RendererUnavailable when nullRenderer fails', () =>
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const root = document.createElement('div')
      const frames = manualFrames()
      const { screens } = makeTestScreens()

      const mockFetch = fakeFetch({
        '/assets/title.png': { chunks: [new Uint8Array([1])] },
      })

      const game: GameDefinition = {
        root,
        hosting: {
          gameId: 'test-game',
          wants: [],
          pauseBehavior: 'pause',
        },
        content: {
          data: fixtureContentData,
          hash: contentHashOf(fixtureContentData),
        },
        screens,
        renderer: nullRenderer([], { fail: true }),
        seams: {
          fetch: mockFetch.fetch,
          frames,
          fonts: { load: () => Promise.resolve([]) },
          sdkEnv: () => {
            const host = createFakeHost({
              gameOrigin: TEST_GAME_ORIGIN,
              gameId: 'test-game',
              clock: realClock,
            })
            return host.gameEnv!
          },
        },
      }

      const fiber = yield* Effect.fork(bootProgram(game).pipe(Scope.extend(scope)))
      yield* advanceFirstFrame(frames)
      const result = yield* Effect.flip(Fiber.join(fiber))

      expect(result).toBeInstanceOf(RendererUnavailable)

      yield* Scope.close(scope, Exit.void)
    }).pipe(Effect.runPromise))

  it('renderer factory throwing inside Effect.sync becomes BootDefect', () =>
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const root = document.createElement('div')
      const frames = manualFrames()
      const { screens } = makeTestScreens()

      const mockFetch = fakeFetch({
        '/assets/title.png': { chunks: [new Uint8Array([1])] },
      })

      const throwingRenderer = () =>
        Effect.sync(() => {
          throw new Error('defect inside renderer factory')
        })

      const game: GameDefinition = {
        root,
        hosting: {
          gameId: 'test-game',
          wants: [],
          pauseBehavior: 'pause',
        },
        content: {
          data: fixtureContentData,
          hash: contentHashOf(fixtureContentData),
        },
        screens,
        renderer: throwingRenderer as any,
        seams: {
          fetch: mockFetch.fetch,
          frames,
          fonts: { load: () => Promise.resolve([]) },
          sdkEnv: () => {
            const host = createFakeHost({
              gameOrigin: TEST_GAME_ORIGIN,
              gameId: 'test-game',
              clock: realClock,
            })
            return host.gameEnv!
          },
        },
      }

      const fiber = yield* Effect.fork(bootProgram(game).pipe(Scope.extend(scope)))
      yield* advanceFirstFrame(frames)
      const result = yield* Effect.flip(Fiber.join(fiber))

      expect(result).toBeInstanceOf(BootDefect)
      expect(String((result as BootDefect).cause)).toContain('defect inside renderer factory')

      yield* Scope.close(scope, Exit.void)
    }).pipe(Effect.runPromise))

  it('ready silence: autoReady=false and 30s on TestClock fails with HostError{TIMEOUT, ready}', () =>
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const root = document.createElement('div')
      const frames = manualFrames()
      const { screens } = makeTestScreens()

      const mockFetch = fakeFetch({
        '/assets/title.png': { chunks: [new Uint8Array([1])] },
      })

      const game: GameDefinition = {
        root,
        hosting: {
          gameId: 'test-game',
          wants: [],
          pauseBehavior: 'pause',
        },
        content: {
          data: fixtureContentData,
          hash: contentHashOf(fixtureContentData),
        },
        screens,
        renderer: nullRenderer(),
        seams: {
          fetch: mockFetch.fetch,
          frames,
          fonts: { load: () => Promise.resolve([]) },
          sdkEnv: () => {
            const host = createFakeHost({
              gameOrigin: TEST_GAME_ORIGIN,
              gameId: 'test-game',
              clock: realClock,
              autoReady: false,
            })
            return host.gameEnv!
          },
        },
      }

      const fiber = yield* Effect.fork(bootProgram(game).pipe(Scope.extend(scope)))
      yield* advanceFirstFrame(frames)

      // Advance 30 seconds on TestClock to trigger timeout
      yield* TestClock.adjust('30 seconds')
      const result = yield* Effect.flip(Fiber.join(fiber))

      expect(result).toBeInstanceOf(HostError)
      const hostErr = result as HostError
      expect(hostErr.code).toBe('TIMEOUT')
      expect(hostErr.retryable).toBe(true)
      expect(hostErr.operation).toBe('ready')

      yield* Scope.close(scope, Exit.void)
    }).pipe(Effect.provide(TestContext.TestContext), Effect.runPromise))

  it('preload loads game.preload_screens, else flow entry', () =>
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const root = document.createElement('div')
      const frames = manualFrames()
      const { screens } = makeTestScreens()

      const requestedUrls: string[] = []
      const mockFetch = fakeFetch({
        '/assets/title.png': { chunks: [new Uint8Array([1])] },
        '/assets/play.png': { chunks: [new Uint8Array([2])] },
      })
      const trackingFetch: typeof fetch = (input, init) => {
        requestedUrls.push(String(input))
        return mockFetch.fetch(input, init)
      }

      const gameWithPlayPreload: GameDefinition = {
        root,
        hosting: {
          gameId: 'test-game',
          wants: [],
          pauseBehavior: 'pause',
        },
        content: {
          data: {
            ...fixtureContentData,
            flow: {
              ...fixtureContentData.flow,
              entry: 'play',
            },
            game: {
              ...fixtureContentData.game!,
              preload_screens: ['play'],
            },
          },
          hash: contentHashOf({
            ...fixtureContentData,
            flow: {
              ...fixtureContentData.flow,
              entry: 'play',
            },
            game: {
              ...fixtureContentData.game!,
              preload_screens: ['play'],
            },
          }),
        },
        screens,
        renderer: nullRenderer(),
        seams: {
          fetch: trackingFetch,
          frames,
          fonts: { load: () => Promise.resolve([]) },
          sdkEnv: () => {
            const host = createFakeHost({
              gameOrigin: TEST_GAME_ORIGIN,
              gameId: 'test-game',
              clock: realClock,
            })
            return host.gameEnv!
          },
        },
      }

      const fiber = yield* Effect.fork(bootProgram(gameWithPlayPreload).pipe(Scope.extend(scope)))
      yield* advanceFirstFrame(frames)
      yield* Fiber.join(fiber)

      expect(requestedUrls).toEqual(['/assets/play.png'])

      yield* Scope.close(scope, Exit.void)
    }).pipe(Effect.runPromise))

  // Review of #241: files a game preloads outside its content (a 3D game's models) load before the renderer, with
  // the content's own files, and stay out of content.hash so a new origin or a rebuilt asset never changes it.
  it('loads game.preload with the preload screens, before the renderer, outside content.hash', () =>
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const root = document.createElement('div')
      const frames = manualFrames()
      const { screens } = makeTestScreens()
      const requestedUrls: string[] = []
      const mockFetch = fakeFetch({
        '/assets/title.png': { chunks: [new Uint8Array([1])] },
        'http://cdn.test/models/crate.glb': { chunks: [new Uint8Array([7, 7])] },
      })
      const trackingFetch: typeof fetch = (input, init) => {
        requestedUrls.push(String(input))
        return mockFetch.fetch(input, init)
      }
      let seenByRenderer: Blob | undefined
      const game: GameDefinition = {
        root,
        hosting: { gameId: 'test-game', wants: [], pauseBehavior: 'pause' },
        content: { data: fixtureContentData, hash: contentHashOf(fixtureContentData) },
        preload: ['http://cdn.test/models/crate.glb'],
        screens,
        renderer: (target) =>
          Effect.sync(() => {
            seenByRenderer = target.assets.get('http://cdn.test/models/crate.glb')
            return { apply: () => {}, draw: () => {}, reset: () => {} }
          }),
        seams: {
          fetch: trackingFetch,
          frames,
          fonts: { load: () => Promise.resolve([]) },
          sdkEnv: () =>
            createFakeHost({ gameOrigin: TEST_GAME_ORIGIN, gameId: 'test-game', clock: realClock }).gameEnv!,
        },
      }

      const fiber = yield* Effect.fork(bootProgram(game).pipe(Scope.extend(scope)))
      yield* advanceFirstFrame(frames)
      yield* Fiber.join(fiber)

      expect(requestedUrls.sort()).toEqual(['/assets/title.png', 'http://cdn.test/models/crate.glb'])
      expect(seenByRenderer?.size).toBe(2)
      yield* Scope.close(scope, Exit.void)
    }).pipe(Effect.runPromise))

  // M3.4a, review of #241: a renderer whose graphics context will not come back asks for the panel through its
  // target; Try again closes the panel and hands back to the renderer, which rebuilds itself.
  it('shows the context-lost panel a renderer asks for, and Try again hands back to it', () =>
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const root = document.createElement('div')
      document.body.appendChild(root)
      const frames = manualFrames()
      const { screens } = makeTestScreens()
      let reportLost: RenderTarget['reportLost']
      const game: GameDefinition = {
        root,
        hosting: { gameId: 'test-game', wants: [], pauseBehavior: 'pause' },
        content: { data: fixtureContentData, hash: contentHashOf(fixtureContentData) },
        screens,
        renderer: (target) =>
          Effect.sync(() => {
            reportLost = target.reportLost
            return { apply: () => {}, draw: () => {}, reset: () => {} }
          }),
        seams: {
          fetch: fakeFetch({ '/assets/title.png': { chunks: [new Uint8Array([1])] } }).fetch,
          frames,
          fonts: { load: () => Promise.resolve([]) },
          sdkEnv: () =>
            createFakeHost({ gameOrigin: TEST_GAME_ORIGIN, gameId: 'test-game', clock: realClock }).gameEnv!,
        },
      }

      const fiber = yield* Effect.fork(bootProgram(game).pipe(Scope.extend(scope)))
      yield* advanceFirstFrame(frames)
      yield* Fiber.join(fiber)

      const retried: string[] = []
      reportLost?.(() => void retried.push('retry'))
      const alert = root.querySelector('[role="alert"]')
      expect(alert?.getAttribute('data-code')).toBe('context-lost')
      expect(alert?.textContent).toContain('The picture stopped.')
      const button = Array.from(root.querySelectorAll('button')).find((b) =>
        b.textContent?.includes('Try again'),
      )
      button?.click()
      expect(retried).toEqual(['retry'])
      expect(root.querySelector('[role="alert"]')).toBeNull()

      yield* Scope.close(scope, Exit.void)
      root.remove()
    }).pipe(Effect.runPromise))

  it('menu handler: after ready, host.bridge.openGameMenu() reaches current screen openMenu', () =>
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const root = document.createElement('div')
      const frames = manualFrames()
      const { screens, menuCalls } = makeTestScreens()
      let fakeHostInstance: FakeHost | undefined

      const mockFetch = fakeFetch({
        '/assets/title.png': { chunks: [new Uint8Array([1])] },
      })

      const game: GameDefinition = {
        root,
        hosting: {
          gameId: 'test-game',
          wants: ['menu'],
          pauseBehavior: 'pause',
        },
        content: {
          data: fixtureContentData,
          hash: contentHashOf(fixtureContentData),
        },
        screens,
        renderer: nullRenderer(),
        seams: {
          fetch: mockFetch.fetch,
          frames,
          fonts: { load: () => Promise.resolve([]) },
          sdkEnv: () => {
            fakeHostInstance = createFakeHost({
              gameOrigin: TEST_GAME_ORIGIN,
              gameId: 'test-game',
              clock: realClock,
            })
            return fakeHostInstance.gameEnv!
          },
        },
      }

      const fiber = yield* Effect.fork(bootProgram(game).pipe(Scope.extend(scope)))
      yield* advanceFirstFrame(frames)
      yield* Fiber.join(fiber)

      // Title screen is entered
      expect(fakeHostInstance).toBeDefined()
      const opened = yield* Effect.promise(() => fakeHostInstance!.bridge.openGameMenu())
      yield* Effect.promise(() => settle(2))
      expect(opened).toBe(true)
      expect(menuCalls).toEqual(['title'])

      yield* Scope.close(scope, Exit.void)
    }).pipe(Effect.runPromise))

  it('provides Audio and AudioBuses to screens, builds the seam context on a gesture, and plays the game sounds (M5.3)', () =>
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const root = document.createElement('div')
      document.body.appendChild(root)
      Scope.addFinalizer(
        scope,
        Effect.sync(() => root.remove()),
      )
      const frames = manualFrames()
      const contexts: FakeAudioContext[] = []
      const seen: { audio?: Audio; buses?: AudioBuses; bus?: PresentationBus } = {}
      const { screens } = makeTestScreens()
      const title: ScreenDef = {
        id: 'title',
        enter: () =>
          Effect.gen(function* () {
            seen.audio = yield* Audio
            seen.buses = yield* AudioBuses
            seen.bus = yield* PresentationBus
          }),
      }
      const game: GameDefinition = {
        root,
        hosting: { gameId: 'test-game', wants: [], pauseBehavior: 'pause' },
        content: { data: fixtureContentData, hash: contentHashOf(fixtureContentData) },
        screens: [title, ...screens.filter((screen) => screen.id !== 'title')],
        renderer: nullRenderer(),
        sounds: { chime: 'chime.wav' },
        seams: {
          fetch: fakeFetch({
            '/assets/title.png': { chunks: [new Uint8Array([1])] },
            'chime.wav': { chunks: [new TextEncoder().encode('chime.wav')] },
          }).fetch,
          frames,
          fonts: { load: () => Promise.resolve([]) },
          createAudioContext: () => {
            const context = fakeAudioContext()
            contexts.push(context)
            return context
          },
          sdkEnv: () =>
            createFakeHost({ gameOrigin: TEST_GAME_ORIGIN, gameId: 'test-game', clock: realClock }).gameEnv!,
        },
      }

      const fiber = yield* Effect.fork(bootProgram(game).pipe(Scope.extend(scope)))
      yield* advanceFirstFrame(frames)
      yield* Fiber.join(fiber)
      expect(seen.audio).toBeDefined()
      expect(seen.buses).toBe(seen.audio)

      window.dispatchEvent(new Event('pointerdown'))
      yield* Effect.promise(() => settle(2))
      expect(contexts).toHaveLength(1)
      expect(seen.audio!.unlocked.get()).toBe(true)

      seen.bus!.publish('sim.events', [{ type: 'chime', payload: {} }])
      yield* Effect.promise(() => settle(2))
      expect(contexts[0]?.started.map((started) => started.alias)).toEqual(['chime.wav'])

      yield* Scope.close(scope, Exit.void)
      expect(contexts[0]?.closed).toBe(true)
    }).pipe(Effect.runPromise))
  it('provides Haptics to screens: the game’s seam here, the browser’s otherwise (redo step 10)', () =>
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const root = document.createElement('div')
      document.body.appendChild(root)
      Scope.addFinalizer(
        scope,
        Effect.sync(() => root.remove()),
      )
      const frames = manualFrames()
      const haptics = createHaptics({ touch: () => false })
      const seen: { haptics?: Haptics } = {}
      const { screens } = makeTestScreens()
      const title: ScreenDef = {
        id: 'title',
        enter: () =>
          Effect.gen(function* () {
            seen.haptics = yield* Haptics
          }),
      }
      const game: GameDefinition = {
        root,
        hosting: { gameId: 'test-game', wants: [], pauseBehavior: 'pause' },
        content: { data: fixtureContentData, hash: contentHashOf(fixtureContentData) },
        screens: [title, ...screens.filter((screen) => screen.id !== 'title')],
        renderer: nullRenderer(),
        seams: {
          fetch: fakeFetch({ '/assets/title.png': { chunks: [new Uint8Array([1])] } }).fetch,
          frames,
          fonts: { load: () => Promise.resolve([]) },
          haptics,
        },
      }
      const fiber = yield* Effect.fork(bootProgram(game).pipe(Scope.extend(scope)))
      yield* advanceFirstFrame(frames)
      yield* Fiber.join(fiber)
      expect(seen.haptics).toBe(haptics)
      yield* Scope.close(scope, Exit.void)
    }).pipe(Effect.runPromise))

  it('provides Leaderboards to screens and submits the game scores for sim events (M5.7)', () =>
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const root = document.createElement('div')
      document.body.appendChild(root)
      Scope.addFinalizer(
        scope,
        Effect.sync(() => root.remove()),
      )
      const frames = manualFrames()
      let fakeHost: FakeHost | undefined
      const seen: { boards?: Leaderboards; bus?: PresentationBus } = {}
      const { screens } = makeTestScreens()
      const title: ScreenDef = {
        id: 'title',
        enter: () =>
          Effect.gen(function* () {
            seen.boards = yield* Leaderboards
            seen.bus = yield* PresentationBus
          }),
      }
      const game: GameDefinition = {
        root,
        hosting: { gameId: 'test-game', wants: ['leaderboards'], pauseBehavior: 'pause' },
        content: { data: fixtureContentData, hash: contentHashOf(fixtureContentData) },
        screens: [title, ...screens.filter((screen) => screen.id !== 'title')],
        renderer: nullRenderer(),
        scores: { finished: { board: 'best', score: (payload) => (payload as { ticks: number }).ticks } },
        seams: {
          fetch: fakeFetch({ '/assets/title.png': { chunks: [new Uint8Array([1])] } }).fetch,
          frames,
          fonts: { load: () => Promise.resolve([]) },
          createAudioContext: () => fakeAudioContext(),
          sdkEnv: () => {
            fakeHost = createFakeHost({
              gameOrigin: TEST_GAME_ORIGIN,
              gameId: 'test-game',
              clock: realClock,
              grant: ['leaderboards'],
            })
            return fakeHost.gameEnv!
          },
        },
      }

      const fiber = yield* Effect.fork(bootProgram(game).pipe(Scope.extend(scope)))
      yield* advanceFirstFrame(frames)
      yield* Fiber.join(fiber)
      expect(seen.boards).toBeDefined()

      seen.bus!.publish('sim.events', [{ type: 'finished', payload: { ticks: 300 } }])
      yield* Effect.promise(() => settle(4))
      expect(fakeHost!.fakes.leaderboards.submits).toEqual([{ board: 'best', score: 300 }])
      expect(seen.boards!.state('best')).toEqual({ state: 'accepted', personalBest: 300, rank: 1 })

      yield* Scope.close(scope, Exit.void)
    }).pipe(Effect.runPromise))

  it('keeps the rotate hint over a portrait game on a phone held sideways, paused for display (M4.7)', () =>
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const root = document.createElement('div')
      document.body.appendChild(root)
      const size = { width: window.innerWidth, height: window.innerHeight }
      const resize = (width: number, height: number) => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
        Object.defineProperty(window, 'innerHeight', { configurable: true, value: height })
      }
      resize(844, 390)
      Object.defineProperty(window, 'matchMedia', {
        configurable: true,
        value: (media: string) => ({
          matches: media.includes('pointer: coarse'),
          addEventListener: () => {},
          removeEventListener: () => {},
        }),
      })
      Scope.addFinalizer(
        scope,
        Effect.sync(() => {
          root.remove()
          resize(size.width, size.height)
          Reflect.deleteProperty(window, 'matchMedia')
        }),
      )
      const frames = manualFrames()
      const seen: { time?: Time } = {}
      const { screens } = makeTestScreens()
      const title: ScreenDef = {
        id: 'title',
        enter: () =>
          Effect.gen(function* () {
            seen.time = yield* Time
          }),
      }
      const game: GameDefinition = {
        root,
        hosting: { gameId: 'test-game', wants: [], pauseBehavior: 'pause' },
        content: { data: fixtureContentData, hash: contentHashOf(fixtureContentData) },
        screens: [title, ...screens.filter((screen) => screen.id !== 'title')],
        renderer: nullRenderer(),
        orientation: 'portrait',
        seams: {
          fetch: fakeFetch({ '/assets/title.png': { chunks: [new Uint8Array([1])] } }).fetch,
          frames,
          fonts: { load: () => Promise.resolve([]) },
          createAudioContext: () => fakeAudioContext(),
        },
      }

      const fiber = yield* Effect.fork(bootProgram(game).pipe(Scope.extend(scope)))
      yield* advanceFirstFrame(frames)
      yield* Fiber.join(fiber)
      yield* Effect.promise(() => settle(2))
      expect(root.querySelector('[data-testid="rotate-hint"]')).not.toBeNull()
      expect([...(seen.time?.reasons ?? [])]).toContain('display')

      yield* Scope.close(scope, Exit.void)
    }).pipe(Effect.runPromise))
})

describe('bootProgram, settings kept on the device (M5.2, M5-D4)', () => {
  const memoryDevice = () => {
    const held = new Map<string, string>()
    return {
      held,
      get: (key: string) => held.get(key) ?? null,
      set: (key: string, value: string) => void held.set(key, value),
      remove: (key: string) => void held.delete(key),
    }
  }

  it('keeps the core audio choices in the device storage the game gets, and out of the saves', () =>
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const root = document.createElement('div')
      document.body.appendChild(root)
      Scope.addFinalizer(
        scope,
        Effect.sync(() => root.remove()),
      )
      const frames = manualFrames()
      const host = createFakeHost({ gameOrigin: TEST_GAME_ORIGIN, gameId: 'test-game', clock: realClock })
      const device = memoryDevice()
      let store: SettingsStore<CoreSettings> | undefined
      const { screens } = makeTestScreens()
      const title: ScreenDef = {
        id: 'title',
        enter: () =>
          Effect.gen(function* () {
            store = yield* settingsStore(CORE_SETTINGS)
          }),
      }
      const game: GameDefinition<CoreSettings> = {
        root,
        hosting: { gameId: 'test-game', wants: ['saves'], pauseBehavior: 'pause' },
        content: { data: fixtureContentData, hash: contentHashOf(fixtureContentData) },
        screens: [title, ...screens.filter((screen) => screen.id !== 'title')],
        renderer: nullRenderer(),
        settings: CORE_SETTINGS,
        seams: {
          fetch: fakeFetch({ '/assets/title.png': { chunks: [new Uint8Array([1])] } }).fetch,
          frames,
          fonts: { load: () => Promise.resolve([]) },
          deviceStorage: device,
          sdkEnv: () => host.gameEnv!,
        },
      }

      const fiber = yield* Effect.fork(bootProgram(game).pipe(Scope.extend(scope)))
      yield* advanceFirstFrame(frames)
      yield* Fiber.join(fiber)
      expect(store).toBeDefined()

      store!.update((value) => ({
        ...value,
        display: { quality: 'low' },
        audio: { ...value.audio, muted: true },
      }))
      yield* Effect.promise(() => settle(2))

      expect(JSON.parse(device.held.get('settings:device') ?? 'null')).toMatchObject({
        audio: { muted: true },
      })
      const written = host.messages
        .filter((entry) => entry.dir === 'in' && entry.msg.type === 'saves.set')
        .map((entry) => entry.msg.payload as { key: string; value: string })
      expect(written.map((write) => write.key)).toEqual(['settings'])
      expect(written[0]?.value).toContain('"low"')
      expect(written[0]?.value).not.toMatch(/muted|gains/)

      yield* Scope.close(scope, Exit.void)
    }).pipe(Effect.runPromise))
})

describe('bootProgram, the game save (M5.2)', () => {
  it('writes the touched progress, then flushes, before the host is told the game may close', () =>
    Effect.gen(function* () {
      const scope = yield* Scope.make()
      const root = document.createElement('div')
      document.body.appendChild(root)
      Scope.addFinalizer(
        scope,
        Effect.sync(() => root.remove()),
      )
      const frames = manualFrames()
      const host = createFakeHost({ gameOrigin: TEST_GAME_ORIGIN, gameId: 'test-game', clock: realClock })
      const run = defineSave<{ coins: number }>({
        key: 'run',
        version: 1,
        schema: z.object({ coins: z.number() }),
        empty: () => ({ coins: 0 }),
        migrations: {},
      })
      let save: Save<{ coins: number }> | undefined
      const { screens } = makeTestScreens()
      const title: ScreenDef = {
        id: 'title',
        enter: () =>
          Effect.gen(function* () {
            save = saveOf(yield* Saves, run)
          }),
      }
      const game: GameDefinition = {
        root,
        hosting: { gameId: 'test-game', wants: ['saves'], pauseBehavior: 'pause' },
        content: { data: fixtureContentData, hash: contentHashOf(fixtureContentData) },
        screens: [title, ...screens.filter((screen) => screen.id !== 'title')],
        renderer: nullRenderer(),
        saves: run,
        seams: {
          fetch: fakeFetch({ '/assets/title.png': { chunks: [new Uint8Array([1])] } }).fetch,
          frames,
          fonts: { load: () => Promise.resolve([]) },
          sdkEnv: () => host.gameEnv!,
        },
      }

      const fiber = yield* Effect.fork(bootProgram(game).pipe(Scope.extend(scope)))
      yield* advanceFirstFrame(frames)
      yield* Fiber.join(fiber)
      yield* Effect.promise(() => save!.load(0))
      save!.touch(() => ({ coins: 7 }))

      yield* Effect.promise(() => host.bridge.exit())
      const sent = host.messages
        .filter((entry) => entry.dir === 'in')
        .map((entry) => entry.msg.type)
        .filter((type) => ['saves.set', 'saves.flush', 'session.exitReady'].includes(type))
      expect(sent).toEqual(['saves.set', 'saves.flush', 'session.exitReady'])

      yield* Scope.close(scope, Exit.void)
    }).pipe(Effect.runPromise))
})
