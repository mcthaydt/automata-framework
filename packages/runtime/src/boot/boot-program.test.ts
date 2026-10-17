import type { FlowGraph } from '@mcthaydt/automata-content'
import { contentHash } from '@mcthaydt/automata-content'
import { HostError, type Hosting } from '@mcthaydt/automata-host'
import { realClock, TEST_GAME_ORIGIN } from '@mcthaydt/automata-host/testing'
import { createFakeHost, type FakeHost, settle } from '@ruken/sdk-host/testing'
import { Effect, Exit, Fiber, Scope, TestClock, TestContext } from 'effect'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import type { ScreenDef } from '../flow/screen.js'
import { PresentationBus } from '../presentation/presentation-bus.manager.js'
import type { RenderTarget } from '../render/renderer.js'
import { fakeFetch } from '../testing/fake-fetch.js'
import { manualFrames } from '../testing/manual-frames.js'
import { nullRenderer } from '../testing/null-renderer.js'
import {
  AssetLoadFailed,
  BootDefect,
  ContentHashMismatch,
  LoadStalled,
  RendererUnavailable,
} from './boot-error.js'
import { bootProgram, contentHashOf } from './boot-program.js'
import type { CompiledContentData, GameDefinition } from './game-definition.js'

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
})
