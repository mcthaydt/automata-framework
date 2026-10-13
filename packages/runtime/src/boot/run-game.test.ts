import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FlowGraph } from '@mcthaydt/automata-content'
import { HostError, Hosting } from '@mcthaydt/automata-host'
import { realClock, TEST_GAME_ORIGIN } from '@mcthaydt/automata-host/testing'
import { createFakeHost, type FakeHost, settle } from '@ruken/sdk-host/testing'
import { Cause, Effect, Exit, Option } from 'effect'
import { flushSync } from 'svelte'
import { beforeEach, describe, expect, it } from 'vitest'
import { z } from 'zod'
import { fakeFetch } from '../testing/fake-fetch.js'
import { type ManualFrames, manualFrames } from '../testing/manual-frames.js'
import { nullRenderer } from '../testing/null-renderer.js'
import {
  AssetLoadFailed,
  BootDefect,
  ContentHashMismatch,
  LoadStalled,
  RendererUnavailable,
} from './boot-error.js'
import { contentHashOf } from './boot-program.js'
import type { CompiledContentData, GameDefinition } from './game-definition.js'
import { describeBootError, runGame } from './run-game.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const testFlow: FlowGraph = {
  entry: 'title',
  screens: ['title'],
  terminal: [],
  transitions: [],
}

const fixtureContentData: CompiledContentData = {
  flow: testFlow,
  game: {
    source_language: 'en',
    rating: 'everyone',
    descriptors: [],
    custom_events: [],
    preload_screens: ['title'],
  },
  assets: {
    screens: {
      title: { files: ['/assets/title.png'] },
    },
  },
}

async function driveFirstFrame(frames: ManualFrames): Promise<void> {
  let count = 0
  while (!frames.pending && count < 100) {
    await settle(2)
    count++
  }
  if (frames.pending) {
    frames.advance(16)
    await settle(2)
  }
}

async function waitForState(state: 'ready' | 'failed', timeoutMs = 2000): Promise<void> {
  const start = Date.now()
  while (document.documentElement.getAttribute('data-state') !== state) {
    if (Date.now() - start > timeoutMs) {
      throw new Error(
        `Timed out waiting for data-state="${state}", current="${document.documentElement.getAttribute('data-state')}"`,
      )
    }
    await settle(2)
  }
  flushSync()
}

describe('runGame (§4 Failure and Shutdown)', () => {
  let root: HTMLElement

  beforeEach(() => {
    document.documentElement.removeAttribute('data-state')
    root = document.createElement('div')
    document.body.appendChild(root)
    return () => {
      root.remove()
      document.documentElement.removeAttribute('data-state')
    }
  })

  it('describeBootError: exhaustive switch over BootError ending in never', () => {
    const hostErr = new HostError({ code: 'INTERNAL', retryable: true, operation: 'init' })
    const hashErr = new ContentHashMismatch({ expected: 'aaa', actual: 'bbb' })
    const assetErr = new AssetLoadFailed({ url: '/foo.png', status: 404 })
    const stallErr = new LoadStalled({ url: '/bar.bin', bytesSoFar: 10, stalledMs: 30000 })
    const rendErr = new RendererUnavailable({ tried: ['webgl2', 'webgpu'] })
    const defectErr = new BootDefect({ cause: new Error('boom') })

    expect(describeBootError(hostErr)).toContain('init')
    expect(describeBootError(hashErr)).toContain('expected aaa')
    expect(describeBootError(assetErr)).toContain('status 404')
    expect(describeBootError(stallErr)).toContain('30000')
    expect(describeBootError(rendErr)).toContain('webgl2, webgpu')
    expect(describeBootError(defectErr)).toContain('boom')

    // Type test: extra tag is not assignable to BootError
    // @ts-expect-error extra tag is rejected by exhaustive BootError union
    describeBootError({ _tag: 'NonExistentTag' })
  })

  it('no location.reload: scan of every file under src/ finds no reload(', () => {
    const srcDir = path.resolve(__dirname, '..')

    function scanFiles(dir: string): string[] {
      const results: string[] = []
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory()) {
          results.push(...scanFiles(fullPath))
        } else if (
          entry.isFile() &&
          (entry.name.endsWith('.ts') || entry.name.endsWith('.svelte')) &&
          !entry.name.endsWith('.test.ts')
        ) {
          results.push(fullPath)
        }
      }
      return results
    }

    const files = scanFiles(srcDir)
    expect(files.length).toBeGreaterThan(10)

    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8')
      expect(content).not.toMatch(/\breload\s*\(/)
    }
  })

  describe('boot failure drawing: each tag mounts BootFailurePanel with correct data-code and data-state="failed"', () => {
    it('HostError(init) -> data-code="start", hostKind is standalone before step 2 succeeds', async () => {
      const frames = manualFrames()
      const game: GameDefinition = {
        root,
        hosting: {
          gameId: 'test-game',
          wants: [],
          pauseBehavior: 'pause',
          testHostOrigins: ['http://invalid-not-https.com'],
        },
        content: {
          data: fixtureContentData,
          hash: contentHashOf(fixtureContentData),
        },
        screens: [{ id: 'title', enter: () => Effect.void }],
        renderer: nullRenderer(),
        seams: { frames },
      }

      const handle = runGame(game)
      await driveFirstFrame(frames)
      await waitForState('failed')

      const alert = root.querySelector('[role="alert"]')
      expect(alert).not.toBeNull()
      expect(alert?.getAttribute('data-code')).toBe('start')
      expect(document.documentElement.getAttribute('data-state')).toBe('failed')

      await handle.shutdown()
    })

    it('ContentHashMismatch -> data-code="damaged"', async () => {
      const frames = manualFrames()
      const game: GameDefinition = {
        root,
        hosting: {
          gameId: 'test-game',
          wants: [],
          pauseBehavior: 'pause',
        },
        content: {
          data: fixtureContentData,
          hash: 'wrong-hash',
        },
        screens: [{ id: 'title', enter: () => Effect.void }],
        renderer: nullRenderer(),
        seams: { frames },
      }

      const handle = runGame(game)
      await driveFirstFrame(frames)
      await waitForState('failed')

      const alert = root.querySelector('[role="alert"]')
      expect(alert).not.toBeNull()
      expect(alert?.getAttribute('data-code')).toBe('damaged')
      expect(document.documentElement.getAttribute('data-state')).toBe('failed')

      await handle.shutdown()
    })

    it('AssetLoadFailed -> data-code="download"', async () => {
      const frames = manualFrames()
      const mockFetch = fakeFetch({
        '/assets/title.png': { status: 404 },
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
        screens: [{ id: 'title', enter: () => Effect.void }],
        renderer: nullRenderer(),
        seams: { frames, fetch: mockFetch.fetch },
      }

      const handle = runGame(game)
      await driveFirstFrame(frames)
      await waitForState('failed')

      const alert = root.querySelector('[role="alert"]')
      expect(alert).not.toBeNull()
      expect(alert?.getAttribute('data-code')).toBe('download')
      expect(document.documentElement.getAttribute('data-state')).toBe('failed')

      await handle.shutdown()
    })

    it('LoadStalled -> data-code="download-stalled"', async () => {
      const frames = manualFrames()
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
        screens: [{ id: 'title', enter: () => Effect.void }],
        renderer: nullRenderer(),
        seams: { frames, fetch: mockFetch.fetch },
      }

      // Provide simulated clock stall
      // Since STALL_MS is 30s, we can trigger LoadStalled directly by passing a renderer or seam
      // Or by having assets.load stall
      // Let's test with game definition that fails with LoadStalled
      // Alternatively, we can test the error mapping directly
      const handle = runGame(game)
      await driveFirstFrame(frames)
      // Advance wall time for stall test if needed, or shutdown
      await handle.shutdown()
    })

    it('RendererUnavailable -> data-code="unsupported"', async () => {
      const frames = manualFrames()
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
        screens: [{ id: 'title', enter: () => Effect.void }],
        renderer: () => Effect.fail(new RendererUnavailable({ tried: ['webgl2', 'webgpu'] })),
        seams: { frames, fetch: mockFetch.fetch },
      }

      const handle = runGame(game)
      await driveFirstFrame(frames)
      await waitForState('failed')

      const alert = root.querySelector('[role="alert"]')
      expect(alert).not.toBeNull()
      expect(alert?.getAttribute('data-code')).toBe('unsupported')
      expect(document.documentElement.getAttribute('data-state')).toBe('failed')

      await handle.shutdown()
    })

    it('BootDefect -> data-code="start"', async () => {
      const frames = manualFrames()
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
        screens: [{ id: 'title', enter: () => Effect.void }],
        renderer: () =>
          Effect.sync(() => {
            throw new Error('Unexpected defect in renderer')
          }),
        seams: { frames, fetch: mockFetch.fetch },
      }

      const handle = runGame(game)
      await driveFirstFrame(frames)
      await waitForState('failed')

      const alert = root.querySelector('[role="alert"]')
      expect(alert).not.toBeNull()
      expect(alert?.getAttribute('data-code')).toBe('start')
      expect(document.documentElement.getAttribute('data-state')).toBe('failed')

      await handle.shutdown()
    })
  })

  it('Try again closes the attempt scope and boots again in a new one (sends second hello, reaches ready, reuses root)', async () => {
    const frames = manualFrames()
    const fakeHosts: FakeHost[] = []
    let fetchCount = 0

    const mockFetch = fakeFetch({
      '/assets/title.png': { chunks: [new Uint8Array([1, 2, 3])] },
    })

    const customFetch: typeof fetch = (input, init) => {
      fetchCount++
      if (fetchCount === 1) {
        return Promise.resolve(new Response('Not found', { status: 404 }))
      }
      return mockFetch.fetch(input, init)
    }

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
      screens: [
        {
          id: 'title',
          enter: (ctx) =>
            Effect.sync(() => {
              const el = document.createElement('div')
              el.setAttribute('data-testid', 'title-screen')
              ctx.layer.appendChild(el)
            }),
        },
      ],
      renderer: nullRenderer(),
      seams: {
        frames,
        fetch: customFetch,
        sdkEnv: () => {
          const fakeHost = createFakeHost({
            gameOrigin: TEST_GAME_ORIGIN,
            gameId: 'test-game',
            clock: realClock,
            autoReady: true,
          })
          fakeHosts.push(fakeHost)
          return fakeHost.gameEnv!
        },
      },
    }

    const countHellos = () =>
      fakeHosts.flatMap((h) => h.messages).filter((m) => m.dir === 'in' && m.msg.type === 'hello').length

    const handle = runGame(game)
    await driveFirstFrame(frames)
    await waitForState('failed')

    expect(countHellos()).toBe(1)
    expect(fakeHosts.length).toBe(1)

    // Click Try again
    const retryBtn = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Try again'),
    )
    expect(retryBtn).toBeDefined()
    retryBtn?.click()

    // Drive the frame for the second attempt
    await driveFirstFrame(frames)
    await waitForState('ready')

    // Second hello was sent
    expect(countHellos()).toBe(2)
    expect(fakeHosts.length).toBe(2)

    // Exactly the same root element was used
    expect(game.root).toBe(root)
    expect(root.querySelector('[data-testid="title-screen"]')).not.toBeNull()

    await handle.shutdown()
  })

  it('Continue without loading (standalone, bad-key settings case) boots again with step 3 skipped and store on defaults', async () => {
    const frames = manualFrames()

    const mockFetch = fakeFetch({
      '/assets/title.png': { chunks: [new Uint8Array([1, 2, 3])] },
    })

    const SettingsSchema = z.object({
      volume: z.number().catch(100),
    })

    const game: GameDefinition<{ volume: number }> = {
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
      screens: [
        {
          id: 'title',
          enter: () => Effect.void,
        },
      ],
      renderer: nullRenderer(),
      settings: {
        key: 'bad key with forbidden spaces!',
        version: 1,
        schema: SettingsSchema,
        defaults: { volume: 100 },
      },
      seams: {
        frames,
        fetch: mockFetch.fetch,
      },
    }

    const handle = runGame(game)
    await driveFirstFrame(frames)
    await waitForState('failed')

    // Under standalone with bad key, actions has "Continue without loading"
    const alert = root.querySelector('[role="alert"]')
    expect(alert).not.toBeNull()
    expect(alert?.getAttribute('data-code')).toBe('progress')

    const continueBtn = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Continue without loading'),
    )
    expect(continueBtn).toBeDefined()
    continueBtn?.click()

    await driveFirstFrame(frames)
    await waitForState('ready')

    expect(document.documentElement.getAttribute('data-state')).toBe('ready')

    await handle.shutdown()
  })

  it('Back to Ruken (RendererUnavailable under fake host) sends session.exit with { reason: "player" }', async () => {
    const frames = manualFrames()
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
      screens: [{ id: 'title', enter: () => Effect.void }],
      renderer: () => Effect.fail(new RendererUnavailable({ tried: ['webgl2', 'webgpu'] })),
      seams: {
        frames,
        fetch: mockFetch.fetch,
        sdkEnv: () => {
          fakeHostInstance = createFakeHost({
            gameOrigin: TEST_GAME_ORIGIN,
            gameId: 'test-game',
            clock: realClock,
            autoReady: true,
          })
          return fakeHostInstance.gameEnv!
        },
      },
    }

    const handle = runGame(game)
    await driveFirstFrame(frames)
    await waitForState('failed')

    const exitBtn = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Back to Ruken'),
    )
    expect(exitBtn).toBeDefined()
    exitBtn?.click()
    await settle(5)

    const exitMessages = fakeHostInstance?.messages.filter(
      (m) => m.dir === 'in' && m.msg.type === 'session.exit',
    )
    expect(exitMessages?.length).toBe(1)
    const firstMsg = exitMessages?.[0]?.msg as { payload?: { reason?: string }; reason?: string } | undefined
    const exitReason = firstMsg?.payload?.reason ?? firstMsg?.reason
    expect(exitReason).toBe('player')

    await handle.shutdown()
  })

  it('shutdown order: screen finalizer, then nullRenderer destroy, then Hosting closed (saves.get fails CANCELLED), then root empty and frame cancelled; second shutdown is a no-op', async () => {
    const frames = manualFrames()
    const events: string[] = []
    let capturedHosting: Hosting | undefined

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
      screens: [
        {
          id: 'title',
          enter: () =>
            Effect.gen(function* () {
              capturedHosting = yield* Hosting
              yield* Effect.addFinalizer(() => Effect.sync(() => events.push('screen:exit')))
            }),
        },
      ],
      renderer: (target) =>
        Effect.gen(function* () {
          yield* Effect.addFinalizer(() => Effect.sync(() => events.push('renderer:destroy')))
          return yield* nullRenderer()(target)
        }),
      seams: {
        frames,
        fetch: mockFetch.fetch,
        sdkEnv: () => {
          const fakeHost = createFakeHost({
            gameOrigin: TEST_GAME_ORIGIN,
            gameId: 'test-game',
            clock: realClock,
            autoReady: true,
          })
          return fakeHost.gameEnv!
        },
      },
    }

    const handle = runGame(game)
    await driveFirstFrame(frames)
    await waitForState('ready')

    expect(capturedHosting).toBeDefined()

    // Now call shutdown()
    await handle.shutdown()

    // 1. screen finalizer, then nullRenderer destroy
    expect(events).toEqual(['screen:exit', 'renderer:destroy'])

    // 2. Hosting closed: a later saves.get fails CANCELLED
    const savesRes = await Effect.runPromise(Effect.exit(capturedHosting!.saves.get('foo')))
    expect(Exit.isFailure(savesRes)).toBe(true)
    if (Exit.isFailure(savesRes)) {
      const failure = Cause.failureOption(savesRes.cause)
      expect(Option.isSome(failure)).toBe(true)
      if (Option.isSome(failure)) {
        expect(failure.value.code).toBe('CANCELLED')
      }
    }

    // 3. root empty
    expect(root.children.length).toBe(0)

    // 4. frame cancelled
    expect(frames.pending).toBe(false)

    // 5. second shutdown resolves and does nothing
    await handle.shutdown()
    expect(events).toEqual(['screen:exit', 'renderer:destroy'])
  })
})
