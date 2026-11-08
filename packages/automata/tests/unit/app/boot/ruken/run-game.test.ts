import * as fs from 'node:fs'
import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { FlowGraph } from '@mcthaydt/automata-content'
import { createSim, definePlugin, defineSystem } from '@mcthaydt/automata-sim'
import { createFakeHost, type FakeHost, settle } from '@ruken/sdk-host/testing'
import { flushSync } from 'svelte'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { contentHashOf } from '#src/app/boot/boot-program.ts'
import type { CompiledContentData, GameDefinition } from '#src/app/boot/game-definition.ts'
import { describeBootError, runGame } from '#src/app/boot/run-game.ts'
import type { Flow } from '#src/app/flow/flow.manager.ts'
import { defineSave } from '#src/features/saves/save.schema.ts'
import { saveOf } from '#src/features/saves/saves.manager.ts'
import type { Hosting as PlainHosting } from '#src/shared/host/hosting.ts'
import { ok, refused } from '#src/shared/lib/result.ts'
import {
  AssetLoadFailed,
  BootDefect,
  ContentHashMismatch,
  HostError,
  LoadStalled,
  ModelInvalid,
  RendererUnavailable,
} from '#src/shared/runtime/boot-error.ts'
import { STALL_MS } from '#src/shared/runtime/load-meter.ts'
import { fakeHosting } from '#src/testing/host/fake-hosting.ts'
import { realClock } from '#src/testing/host/page/clocks.ts'
import { TEST_GAME_ORIGIN } from '#src/testing/host/page/ruken/hosting-test.ts'
import { fakeFetch } from '#src/testing/runtime/fake-fetch.ts'
import { type ManualFrames, manualFrames } from '#src/testing/runtime/manual-frames.ts'
import { nullRenderer } from '#src/testing/runtime/null-renderer.ts'

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

/**
 * Starts a boot whose clock the test moves. `settle` waits on real timers and would never return under fake ones, so
 * a test on fake timers drives the clock itself; the runtime's clock runs on those timers, so what it advances is boot time.
 */
async function startOnFakeTimers(frames: ManualFrames): Promise<void> {
  for (let tries = 0; !frames.pending && tries < 100; tries++) await vi.advanceTimersByTimeAsync(2)
  frames.advance(16)
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
    const modelErr = new ModelInvalid({ file: 'models/crate.glb', reason: 'skinned' })

    expect(describeBootError(hostErr)).toContain('init')
    expect(describeBootError(hashErr)).toContain('expected aaa')
    expect(describeBootError(assetErr)).toContain('status 404')
    expect(describeBootError(stallErr)).toContain('30000')
    expect(describeBootError(rendErr)).toContain('webgl2, webgpu')
    expect(describeBootError(defectErr)).toContain('boom')
    expect(describeBootError(modelErr)).toBe('Model invalid: models/crate.glb (skinned)')

    // Type test: extra tag is not assignable to BootError
    // @ts-expect-error extra tag is rejected by exhaustive BootError union
    describeBootError({ _tag: 'NonExistentTag' })
  })

  it('no location.reload: scan of every file under src/ finds no reload( but the one Try again uses inside a Ruken session (RT.BOOT1)', () => {
    const srcDir = path.resolve(__dirname, '../../../../../src')

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

    const runGameFile = path.join(srcDir, 'app', 'boot', 'run-game.ts')
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf8')
      if (file === runGameFile) {
        // The default of `seams.reload`, called only inside a Ruken session (M1 runtime spec §4).
        expect(content.match(/\blocation\.reload\s*\(/g)?.length).toBe(1)
      } else {
        expect(content, file).not.toMatch(/\breload\s*\(/)
      }
    }
  })

  describe('boot failure drawing: each tag mounts BootFailurePanel with correct data-code and data-state="failed"', () => {
    it('HostError(init) a retry cannot fix -> data-code="start-final"', async () => {
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
        screens: [{ id: 'title', enter: () => {} }],
        renderer: nullRenderer(),
        seams: { frames },
      }

      const handle = runGame(game)
      await driveFirstFrame(frames)
      await waitForState('failed')

      const alert = root.querySelector('[role="alert"]')
      expect(alert).not.toBeNull()
      expect(alert?.getAttribute('data-code')).toBe('start-final')
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
        screens: [{ id: 'title', enter: () => {} }],
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
        screens: [{ id: 'title', enter: () => {} }],
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

    it('LoadStalled -> data-code="download-stalled": a preload that gets no bytes for 30 s fails the boot (STALL_MS)', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] })
      try {
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
          screens: [{ id: 'title', enter: () => {} }],
          renderer: nullRenderer(),
          seams: { frames, fetch: mockFetch.fetch },
        }

        const handle = runGame(game)
        await startOnFakeTimers(frames)
        await vi.advanceTimersByTimeAsync(STALL_MS - 1000)
        expect(mockFetch.requests).toEqual(['/assets/title.png'])
        expect(document.documentElement.getAttribute('data-state')).not.toBe('failed')
        await vi.advanceTimersByTimeAsync(1000)
        flushSync()
        expect(document.documentElement.getAttribute('data-state')).toBe('failed')

        const alert = root.querySelector('[role="alert"]')
        expect(alert?.getAttribute('data-code')).toBe('download-stalled')
        expect(Array.from(root.querySelectorAll('button')).map((b) => b.textContent?.trim())).toEqual([
          'Try again',
        ])

        await handle.shutdown()
      } finally {
        vi.useRealTimers()
      }
    })

    it('HostError(ready) -> data-code="connect": a Ruken host that never says session.ready fails the boot after 30 s', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date', 'performance'] })
      try {
        const frames = manualFrames()
        const mockFetch = fakeFetch({
          '/assets/title.png': { chunks: [new Uint8Array([1, 2, 3])] },
        })
        let fakeHostInstance: FakeHost | undefined
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
          screens: [{ id: 'title', enter: () => {} }],
          renderer: nullRenderer(),
          seams: {
            frames,
            fetch: mockFetch.fetch,
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

        const handle = runGame(game)
        await startOnFakeTimers(frames)
        // The host answered hello and the page loaded, so the wait is for session.ready alone.
        await vi.advanceTimersByTimeAsync(STALL_MS - 1000)
        expect(mockFetch.requests).toEqual(['/assets/title.png'])
        expect(document.documentElement.getAttribute('data-state')).not.toBe('failed')
        await vi.advanceTimersByTimeAsync(1000)
        flushSync()
        expect(document.documentElement.getAttribute('data-state')).toBe('failed')

        const alert = root.querySelector('[role="alert"]')
        expect(alert?.getAttribute('data-code')).toBe('connect')
        expect(Array.from(root.querySelectorAll('button')).map((b) => b.textContent?.trim())).toEqual([
          'Try again',
        ])
        expect(fakeHostInstance?.messages.some((m) => m.dir === 'in' && m.msg.type === 'hello')).toBe(true)

        await handle.shutdown()
      } finally {
        vi.useRealTimers()
      }
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
        screens: [{ id: 'title', enter: () => {} }],
        renderer: async () => refused(new RendererUnavailable({ tried: ['webgl2', 'webgpu'] })),
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

    it('ModelInvalid -> data-code="model-invalid", naming the file, with Try again (M3 spec §6, D3-f)', async () => {
      const frames = manualFrames()
      const mockFetch = fakeFetch({
        '/assets/title.png': { chunks: [new Uint8Array([1, 2, 3])] },
      })
      const game: GameDefinition = {
        root,
        hosting: { gameId: 'test-game', wants: [], pauseBehavior: 'pause' },
        content: { data: fixtureContentData, hash: contentHashOf(fixtureContentData) },
        screens: [{ id: 'title', enter: () => {} }],
        renderer: async () => refused(new ModelInvalid({ file: 'models/crate.glb', reason: 'skinned' })),
        seams: { frames, fetch: mockFetch.fetch },
      }

      const handle = runGame(game)
      await driveFirstFrame(frames)
      await waitForState('failed')

      const alert = root.querySelector('[role="alert"]')
      expect(alert?.getAttribute('data-code')).toBe('model-invalid')
      expect(alert?.textContent).toContain('damaged: crate.glb.')
      expect(Array.from(root.querySelectorAll('button')).map((b) => b.textContent?.trim())).toContain(
        'Try again',
      )

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
        screens: [{ id: 'title', enter: () => {} }],
        renderer: async () => {
          throw new Error('Unexpected defect in renderer')
        },
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

  it('standalone, Try again closes the attempt scope and boots again in a new one (a new SDK session, ready, the same root, no reload)', async () => {
    const frames = manualFrames()
    const fakeHosts: FakeHost[] = []
    let fetchCount = 0
    let reloads = 0

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
          enter: (ctx) => {
            const el = document.createElement('div')
            el.setAttribute('data-testid', 'title-screen')
            ctx.layer.appendChild(el)
          },
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
          // A top-level page: the SDK runs standalone and sends no hello (RT.BOOT1 keeps the in-place retry here).
          return { ...fakeHost.gameEnv!, isTopLevel: true }
        },
        reload: () => {
          reloads++
        },
      },
    }

    const countHellos = () =>
      fakeHosts.flatMap((h) => h.messages).filter((m) => m.dir === 'in' && m.msg.type === 'hello').length

    const handle = runGame(game)
    await driveFirstFrame(frames)
    await waitForState('failed')

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

    // A second SDK session, in place
    expect(fakeHosts.length).toBe(2)
    expect(countHellos()).toBe(0)
    expect(reloads).toBe(0)

    // Exactly the same root element was used
    expect(game.root).toBe(root)
    expect(root.querySelector('[data-testid="title-screen"]')).not.toBeNull()

    await handle.shutdown()
  })

  it('inside a Ruken session, Try again reloads the frame and sends no second hello (RT.BOOT1: the host answers one hello per frame load)', async () => {
    const frames = manualFrames()
    const fakeHosts: FakeHost[] = []
    let fetchCount = 0
    let reloads = 0

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
          enter: (ctx) => {
            const el = document.createElement('div')
            el.setAttribute('data-testid', 'title-screen')
            ctx.layer.appendChild(el)
          },
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
        reload: () => {
          reloads++
        },
      },
    }

    const countHellos = () =>
      fakeHosts.flatMap((h) => h.messages).filter((m) => m.dir === 'in' && m.msg.type === 'hello').length

    const handle = runGame(game)
    await driveFirstFrame(frames)
    await waitForState('failed')

    expect(countHellos()).toBe(1)

    const retry = Array.from(root.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Try again'),
    )
    expect(retry).toBeDefined()
    retry?.click()
    await Promise.resolve()

    expect(reloads).toBe(1)
    expect(countHellos()).toBe(1)
    expect(fakeHosts.length).toBe(1)

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
          enter: () => {},
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
      screens: [{ id: 'title', enter: () => {} }],
      renderer: async () => refused(new RendererUnavailable({ tried: ['webgl2', 'webgpu'] })),
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

  it("hides Back to … when the session has no exit grant (the SDK's standalone session; PUB spec §3.1)", async () => {
    const frames = manualFrames()
    const game: GameDefinition = {
      root,
      hosting: { gameId: 'test-game', wants: [], pauseBehavior: 'pause' },
      content: { data: fixtureContentData, hash: contentHashOf(fixtureContentData) },
      screens: [{ id: 'title', enter: () => {} }],
      renderer: async () => refused(new RendererUnavailable({ tried: ['webgl2'] })),
      seams: {
        frames,
        fetch: fakeFetch({ '/assets/title.png': { chunks: [new Uint8Array([1, 2, 3])] } }).fetch,
      },
    }

    const handle = runGame(game)
    await driveFirstFrame(frames)
    await waitForState('failed')

    expect(root.querySelector('[role="alert"]')?.getAttribute('data-code')).toBe('unsupported')
    expect(Array.from(root.querySelectorAll('button')).map((button) => button.textContent?.trim())).toEqual(
      [],
    )

    await handle.shutdown()
  })

  it('shutdown order: screen finalizer, then nullRenderer destroy, then Hosting closed (saves.get fails CANCELLED), then root empty and frame cancelled; second shutdown is a no-op', async () => {
    const frames = manualFrames()
    const events: string[] = []
    let capturedHosting: PlainHosting | undefined

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
          enter: ({ screen, services }) => {
            capturedHosting = services.hosting
            screen.add(() => events.push('screen:exit'))
          },
        },
      ],
      renderer: async (target) => {
        const built = await nullRenderer()(target)
        if (!built.ok) return built
        const renderer = built.value
        return ok({ ...renderer, dispose: () => events.push('renderer:destroy') })
      },
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
    const savesRes = await capturedHosting?.saves.get('foo')
    expect(savesRes?.ok).toBe(false)
    if (savesRes?.ok === false) expect(savesRes.reason.code).toBe('CANCELLED')

    // 3. root empty
    expect(root.children.length).toBe(0)

    // 4. frame cancelled
    expect(frames.pending).toBe(false)

    // 5. second shutdown resolves and does nothing
    await handle.shutdown()
    expect(events).toEqual(['screen:exit', 'renderer:destroy'])
  })

  it('shutdown closes ScreenContext.runtime once: after the current screen and the save’s last flush, before the renderer is destroyed; a transition leaves it open (DX.2c)', async () => {
    const frames = manualFrames()
    const events: string[] = []
    let flow: Flow | undefined
    // No autosave trigger, so the only write that reads the progress is the save's own flush when its scope closes.
    const run = defineSave<{ coins: number }>({
      key: 'run',
      version: 1,
      schema: z.object({ coins: z.number() }),
      empty: () => ({ coins: 0 }),
      migrations: {},
      autosave: { on: [] },
    })
    const data: CompiledContentData = {
      ...fixtureContentData,
      flow: {
        entry: 'title',
        screens: ['title', 'play'],
        terminal: [],
        transitions: [{ from: 'title', event: 'play', to: 'play', transition: 'cut' }],
      },
    }
    const game: GameDefinition = {
      root,
      hosting: { gameId: 'test-game', wants: ['saves'], pauseBehavior: 'pause' },
      content: { data, hash: contentHashOf(data) },
      saves: run,
      screens: [
        {
          id: 'title',
          enter: ({ runtime, screen, services }) => {
            flow = services.flow
            // Kept across screens: the title is long gone when the runtime releases it.
            runtime.add(() => events.push('runtime:closed'))
            screen.add(() => events.push('title:exit'))
          },
        },
        {
          id: 'play',
          enter: async ({ screen, services }) => {
            const save = saveOf(services.saves, run)
            await save.load(0)
            save.touch(() => {
              events.push('save:capture')
              return { coins: 7 }
            })
            screen.add(() => events.push('play:exit'))
          },
        },
      ],
      renderer: async (target) => {
        const built = await nullRenderer()(target)
        if (!built.ok) return built
        const renderer = built.value
        return ok({ ...renderer, dispose: () => events.push('renderer:destroy') })
      },
      seams: {
        frames,
        fetch: fakeFetch({ '/assets/title.png': { chunks: [new Uint8Array([1])] } }).fetch,
        sdkEnv: () =>
          createFakeHost({
            gameOrigin: TEST_GAME_ORIGIN,
            gameId: 'test-game',
            clock: realClock,
            autoReady: true,
          }).gameEnv!,
      },
    }

    const handle = runGame(game)
    await driveFirstFrame(frames)
    await waitForState('ready')
    expect(flow?.dispatch('play')).toBe(true)
    await flow?.settled()
    await settle(2)
    expect(flow?.current).toBe('play')
    expect(events).toEqual(['title:exit'])

    await handle.shutdown()
    expect(events).toEqual(['title:exit', 'play:exit', 'save:capture', 'runtime:closed', 'renderer:destroy'])
    await handle.shutdown()
    expect(events.filter((event) => event === 'runtime:closed')).toHaveLength(1)
  })
})

// The playground (website playground spec §7.2) reports where the reader's code failed, so it needs the cause the
// runtime shows only as a panel: seams.onFailure hears it, after the runtime has handled the failure as usual.
describe('seams.onFailure', () => {
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

  const baseGame = (overrides: Partial<GameDefinition>): GameDefinition => ({
    root,
    hosting: { gameId: 'test-game', wants: [], pauseBehavior: 'pause' },
    content: { data: fixtureContentData, hash: contentHashOf(fixtureContentData) },
    screens: [{ id: 'title', enter: () => {} }],
    renderer: nullRenderer(),
    ...overrides,
  })

  it('hears a boot failure, with the error the renderer threw inside its BootDefect', async () => {
    const frames = manualFrames()
    const failures: unknown[] = []
    const thrown = new Error('Unexpected defect in renderer')
    const handle = runGame(
      baseGame({
        renderer: async () => {
          throw thrown
        },
        seams: {
          frames,
          fetch: fakeFetch({ '/assets/title.png': { chunks: [new Uint8Array([1])] } }).fetch,
          onFailure: (cause) => failures.push(cause),
        },
      }),
    )
    await driveFirstFrame(frames)
    await waitForState('failed')
    expect(failures).toHaveLength(1)
    expect(failures[0]).toBeInstanceOf(BootDefect)
    expect((failures[0] as BootDefect).cause).toBe(thrown)
    expect(root.querySelector('[role="alert"]')).not.toBeNull()
    await handle.shutdown()
  })

  it("hears a running sim's fault, once, with what the system threw", async () => {
    const frames = manualFrames()
    const failures: unknown[] = []
    const thrown = new Error('system failed on tick 3')
    const faulty = definePlugin({
      name: 'faulty',
      systems: [
        defineSystem({
          name: 'faulty-system',
          phase: 'gameplay',
          run(ctx) {
            if (ctx.tick === 3) throw thrown
          },
        }),
      ],
    })
    const sim = await createSim({ seed: 1, plugins: [faulty] })
    const handle = runGame(
      baseGame({
        screens: [
          {
            id: 'title',
            enter: ({ services }) => {
              const loop = services.appLoop
              loop.run({ sim, commands: () => [] })
            },
          },
        ],
        seams: {
          frames,
          fetch: fakeFetch({ '/assets/title.png': { chunks: [new Uint8Array([1])] } }).fetch,
          onFailure: (cause) => failures.push(cause),
        },
      }),
    )
    await driveFirstFrame(frames)
    await waitForState('ready')
    for (let frame = 0; frame < 20 && failures.length === 0; frame += 1) {
      frames.advance(50)
      await settle(2)
    }
    expect(failures).toHaveLength(1)
    const reported = failures[0] as Error & { cause?: unknown }
    expect(reported === thrown || reported.cause === thrown).toBe(true)
    await handle.shutdown()
  })

  it('hears a screen that fails to enter, with what its enter threw', async () => {
    const frames = manualFrames()
    const failures: unknown[] = []
    const thrown = new Error('enter broke')
    const handle = runGame(
      baseGame({
        screens: [
          {
            id: 'title',
            enter: () => {
              throw thrown
            },
          },
        ],
        seams: {
          frames,
          fetch: fakeFetch({ '/assets/title.png': { chunks: [new Uint8Array([1])] } }).fetch,
          onFailure: (cause) => failures.push(cause),
        },
      }),
    )
    await driveFirstFrame(frames)
    for (let tries = 0; tries < 50 && failures.length === 0; tries += 1) await settle(2)
    expect(failures).toHaveLength(1)
    const reported = failures[0] as Error & { cause?: unknown }
    expect(reported === thrown || reported.cause === thrown).toBe(true)
    await handle.shutdown()
  })

  it('still shows the failure when the seam itself throws', async () => {
    const frames = manualFrames()
    const handle = runGame(
      baseGame({
        renderer: async () => {
          throw new Error('Unexpected defect in renderer')
        },
        seams: {
          frames,
          fetch: fakeFetch({ '/assets/title.png': { chunks: [new Uint8Array([1])] } }).fetch,
          onFailure: () => {
            throw new Error('the listener broke')
          },
        },
      }),
    )
    await driveFirstFrame(frames)
    await waitForState('failed')
    expect(root.querySelector('[role="alert"]')).not.toBeNull()
    await handle.shutdown()
  })
})

describe('seams.hosting (DIST.4)', () => {
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

  it('boots on the Hosting the seam makes, in place of the build target’s adapter', async () => {
    const frames = manualFrames()
    const fake = fakeHosting({ target: 'itch', deferReady: true })
    const handle = runGame({
      root,
      hosting: { gameId: 'test-game', wants: [], pauseBehavior: 'pause' },
      content: { data: fixtureContentData, hash: contentHashOf(fixtureContentData) },
      screens: [{ id: 'title', enter: () => {} }],
      renderer: nullRenderer(),
      seams: {
        frames,
        fetch: fakeFetch({ '/assets/title.png': { chunks: [new Uint8Array([1])] } }).fetch,
        hosting: fake.make,
      },
    })
    await driveFirstFrame(frames)
    // The fake host holds ready, so boot waits on it: the game is on the fake, not on the target's adapter.
    expect(document.documentElement.getAttribute('data-state')).not.toBe('ready')
    fake.control.welcome()
    await driveFirstFrame(frames)
    await waitForState('ready')
    await handle.shutdown()
  })

  it('starts at the screen it is asked for and says which screen shows (a dev restart lands where the person was)', async () => {
    const frames = manualFrames()
    const data: CompiledContentData = {
      ...fixtureContentData,
      flow: { entry: 'title', screens: ['title', 'play'], terminal: [], transitions: [] },
    }
    const handle = runGame(
      {
        root,
        hosting: { gameId: 'test-game', wants: [], pauseBehavior: 'pause' },
        content: { data, hash: contentHashOf(data) },
        screens: [
          { id: 'title', enter: () => {} },
          { id: 'play', enter: () => {} },
        ],
        renderer: nullRenderer(),
        seams: {
          frames,
          fetch: fakeFetch({ '/assets/title.png': { chunks: [new Uint8Array([1])] } }).fetch,
          hosting: fakeHosting({ target: 'itch' }).make,
        },
      },
      { at: 'play' },
    )
    // Nothing shows before the flow starts.
    expect(handle.screen).toBeUndefined()
    await driveFirstFrame(frames)
    await waitForState('ready')
    await settle(2)
    expect(handle.screen).toBe('play')
    await handle.shutdown()
    expect(handle.screen).toBeUndefined()
  })

  it('boots on settings defaults when the target does not grant saves (DIST spec §8 flow 5)', async () => {
    const frames = manualFrames()
    // A web page whose storage is blocked: everything a page observes, and no saves.
    const fake = fakeHosting({ target: 'web', granted: ['lifecycle', 'input', 'display', 'audio'] })
    const handle = runGame({
      root,
      hosting: { gameId: 'test-game', wants: ['saves'], pauseBehavior: 'pause' },
      content: { data: fixtureContentData, hash: contentHashOf(fixtureContentData) },
      screens: [{ id: 'title', enter: () => {} }],
      renderer: nullRenderer(),
      settings: {
        key: 'settings',
        version: 1,
        schema: z.object({ volume: z.number() }),
        defaults: { volume: 100 },
      },
      seams: {
        frames,
        fetch: fakeFetch({ '/assets/title.png': { chunks: [new Uint8Array([1])] } }).fetch,
        hosting: fake.make,
      },
    })
    await driveFirstFrame(frames)
    await waitForState('ready')
    expect(root.querySelector('[role="alert"]')).toBeNull()
    await handle.shutdown()
  })
})
