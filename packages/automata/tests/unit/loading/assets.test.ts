import type { AssetsSource } from '@mcthaydt/automata-content'
import { Duration, Effect, Fiber, TestClock, TestContext, type TestServices } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import { makeAssets } from '#src/features/loading/assets.manager.ts'
import { makeLoadMeter } from '#src/features/loading/load-meter.ts'
import { AssetLoadFailed, type LoadStalled } from '#src/shared/runtime/boot-error.ts'
import { fakeFetch } from '#src/testing/runtime/fake-fetch.ts'

const runTest = <A, E>(effect: Effect.Effect<A, E, TestServices.TestServices>): Promise<A> =>
  Effect.runPromise(Effect.provide(effect, TestContext.TestContext) as Effect.Effect<A, E, never>)

describe('Assets', () => {
  it('single flight: two load("title") and one load("menu") sharing a.png make one request for a.png', async () => {
    await Effect.gen(function* () {
      const mock = fakeFetch({
        '/assets/a.png': { chunks: [new Uint8Array([1, 2])] },
        '/assets/b.png': { chunks: [new Uint8Array([3, 4])] },
      })
      const meter = yield* makeLoadMeter
      const assetsSource: AssetsSource = {
        screens: {
          title: { files: ['/assets/a.png', '/assets/b.png'] },
          menu: { files: ['/assets/a.png'] },
        },
      }
      const assets = yield* makeAssets({
        assets: assetsSource,
        fonts: {},
        fetch: mock.fetch,
        meter,
      })

      const f1 = yield* Effect.fork(assets.load('title'))
      const f2 = yield* Effect.fork(assets.load('title'))
      const f3 = yield* Effect.fork(assets.load('menu'))

      yield* Fiber.join(f1)
      yield* Fiber.join(f2)
      yield* Fiber.join(f3)

      expect(mock.requests.filter((r) => r === '/assets/a.png')).toHaveLength(1)
      expect(mock.requests.filter((r) => r === '/assets/b.png')).toHaveLength(1)
      expect(assets.isLoaded('title')).toBe(true)
      expect(assets.isLoaded('menu')).toBe(true)
    }).pipe(runTest)
  })

  it('shared progress: two waiters hear the same fractions; undefined before first byte', async () => {
    await Effect.gen(function* () {
      const chunk1 = new Uint8Array([1, 2])
      const chunk2 = new Uint8Array([3, 4])
      const mock = fakeFetch({
        '/assets/big.bin': {
          chunks: [chunk1, chunk2],
          contentLength: 4,
        },
      })
      const meter = yield* makeLoadMeter
      const assetsSource: AssetsSource = {
        screens: {
          main: { files: ['/assets/big.bin'] },
        },
      }
      const assets = yield* makeAssets({
        assets: assetsSource,
        fonts: {},
        fetch: mock.fetch,
        meter,
      })

      const progress1: (number | undefined)[] = []
      const progress2: (number | undefined)[] = []

      const f1 = yield* Effect.fork(assets.load('main', (p) => progress1.push(p)))
      const f2 = yield* Effect.fork(assets.load('main', (p) => progress2.push(p)))

      yield* Fiber.join(f1)
      yield* Fiber.join(f2)

      expect(progress1).toEqual(progress2)
      expect(progress1[progress1.length - 1]).toBe(1)
    }).pipe(runTest)
  })

  it('a failed file is not remembered: 404 then a fixed route -> next load requests again and succeeds', async () => {
    await Effect.gen(function* () {
      let is404 = true
      const mockFetch: typeof fetch = async (_input, _init) => {
        if (is404) {
          return new Response('Not found', { status: 404 })
        }
        return new Response(new Uint8Array([1, 2, 3]), { status: 200 })
      }
      const meter = yield* makeLoadMeter
      const assetsSource: AssetsSource = {
        screens: { title: { files: ['/assets/retry.png'] } },
      }
      const assets = yield* makeAssets({
        assets: assetsSource,
        fonts: {},
        fetch: mockFetch,
        meter,
      })

      const firstResult = yield* Effect.flip(assets.load('title'))
      expect(firstResult).toBeInstanceOf(AssetLoadFailed)
      expect((firstResult as AssetLoadFailed).status).toBe(404)
      expect(assets.isLoaded('title')).toBe(false)

      is404 = false
      yield* assets.load('title')
      expect(assets.isLoaded('title')).toBe(true)
      expect(assets.get('/assets/retry.png')?.size).toBe(3)
    }).pipe(runTest)
  })

  it('non-OK status fails AssetLoadFailed{url, status: 404}; network error fails with status: 0', async () => {
    await Effect.gen(function* () {
      const mock = fakeFetch({
        '/assets/bad.png': { status: 404 },
        '/assets/net.png': { networkError: true },
      })
      const meter = yield* makeLoadMeter
      const assetsSource: AssetsSource = {
        screens: {
          s1: { files: ['/assets/bad.png'] },
          s2: { files: ['/assets/net.png'] },
        },
      }
      const assets = yield* makeAssets({
        assets: assetsSource,
        fonts: {},
        fetch: mock.fetch,
        meter,
      })

      const err1 = yield* Effect.flip(assets.load('s1'))
      expect(err1).toBeInstanceOf(AssetLoadFailed)
      expect((err1 as AssetLoadFailed).status).toBe(404)
      expect((err1 as AssetLoadFailed).url).toBe('/assets/bad.png')

      const err2 = yield* Effect.flip(assets.load('s2'))
      expect(err2).toBeInstanceOf(AssetLoadFailed)
      expect((err2 as AssetLoadFailed).status).toBe(0)
      expect((err2 as AssetLoadFailed).url).toBe('/assets/net.png')
    }).pipe(runTest)
  })

  it('chunks feed the meter: a file sending a chunk every 10s for 60s does not stall', async () => {
    await Effect.gen(function* () {
      const meter = yield* makeLoadMeter
      // A stream controller feeding chunks over time
      let controllerRef: ReadableStreamDefaultController<Uint8Array> | undefined
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          controllerRef = controller
        },
      })
      const mockFetch: typeof fetch = async () =>
        new Response(stream, { status: 200, headers: { 'content-length': '6' } })

      const assetsSource: AssetsSource = {
        screens: { streamScreen: { files: ['/assets/stream.bin'] } },
      }
      const assets = yield* makeAssets({
        assets: assetsSource,
        fonts: {},
        fetch: mockFetch,
        meter,
      })

      const loadFiber = yield* Effect.fork(assets.load('streamScreen'))

      for (let i = 0; i < 6; i++) {
        yield* TestClock.adjust(Duration.seconds(10))
        controllerRef?.enqueue(new Uint8Array([i]))
      }
      controllerRef?.close()

      yield* Fiber.join(loadFiber)
      expect(assets.isLoaded('streamScreen')).toBe(true)
    }).pipe(runTest)
  })

  it('a file that goes quiet fails LoadStalled at 30s with its bytesSoFar, and fakeFetch.aborted lists it', async () => {
    await Effect.gen(function* () {
      const mock = fakeFetch({
        '/assets/hang.bin': {
          chunks: [new Uint8Array([1, 2, 3])],
          hang: true,
          contentLength: 100,
        },
      })
      const meter = yield* makeLoadMeter
      const assetsSource: AssetsSource = {
        screens: { hungScreen: { files: ['/assets/hang.bin'] } },
      }
      const assets = yield* makeAssets({
        assets: assetsSource,
        fonts: {},
        fetch: mock.fetch,
        meter,
      })

      const fiber = yield* Effect.fork(assets.load('hungScreen'))

      yield* TestClock.adjust(Duration.millis(29_999))
      let poll = yield* Fiber.poll(fiber)
      expect(poll._tag).toBe('None')

      yield* TestClock.adjust(Duration.millis(1))
      poll = yield* Fiber.poll(fiber)
      expect(poll._tag).toBe('Some')
      if (poll._tag === 'Some' && poll.value._tag === 'Failure') {
        const cause = poll.value.cause
        if (cause._tag === 'Fail') {
          const err = cause.error as LoadStalled
          expect(err._tag).toBe('LoadStalled')
          expect(err.url).toBe('/assets/hang.bin')
          expect(err.bytesSoFar).toBe(3)
          expect(err.stalledMs).toBe(30_000)
        }
      }
      expect(mock.aborted).toContain('/assets/hang.bin')
    }).pipe(runTest)
  })

  it('interrupting load aborts the fetch in flight', async () => {
    await Effect.gen(function* () {
      const mock = fakeFetch({
        '/assets/slow.bin': {
          hang: true,
        },
      })
      const meter = yield* makeLoadMeter
      const assetsSource: AssetsSource = {
        screens: { slowScreen: { files: ['/assets/slow.bin'] } },
      }
      const assets = yield* makeAssets({
        assets: assetsSource,
        fonts: {},
        fetch: mock.fetch,
        meter,
      })

      const fiber = yield* Effect.fork(assets.load('slowScreen'))
      yield* TestClock.adjust(Duration.seconds(5))
      yield* Fiber.interrupt(fiber)

      expect(mock.aborted).toContain('/assets/slow.bin')
    }).pipe(runTest)
  })

  it('fonts: a screen fonts are awaited through injected fonts.load; isLoaded is false until both files and fonts finish; stalls at 30s', async () => {
    await Effect.gen(function* () {
      const mock = fakeFetch({
        '/assets/font-test.png': { chunks: [new Uint8Array([1])] },
      })
      const meter = yield* makeLoadMeter
      let resolveFont!: () => void
      const fontPromise = new Promise<void>((res) => {
        resolveFont = res
      })
      const fontFaces = {
        load: vi.fn(async () => {
          await fontPromise
          return []
        }),
      }
      const assetsSource: AssetsSource = {
        screens: { withFonts: { files: ['/assets/font-test.png'] } },
      }
      const assets = yield* makeAssets({
        assets: assetsSource,
        fonts: { withFonts: ['16px CustomFont'] },
        fetch: mock.fetch,
        fontFaces,
        meter,
      })

      const fiber = yield* Effect.fork(assets.load('withFonts'))
      yield* TestClock.adjust(Duration.millis(100))
      expect(fontFaces.load).toHaveBeenCalledWith('16px CustomFont')
      expect(assets.isLoaded('withFonts')).toBe(false)

      resolveFont()
      yield* Fiber.join(fiber)
      expect(assets.isLoaded('withFonts')).toBe(true)

      // Test font load stall
      const neverEndingFontFaces = {
        load: vi.fn(() => new Promise<never>(() => undefined)),
      }
      const stallAssets = yield* makeAssets({
        assets: assetsSource,
        fonts: { withFonts: ['16px BrokenFont'] },
        fetch: mock.fetch,
        fontFaces: neverEndingFontFaces,
        meter,
      })

      const stallFiber = yield* Effect.fork(stallAssets.load('withFonts'))
      yield* TestClock.adjust(Duration.seconds(30))
      const poll = yield* Fiber.poll(stallFiber)
      expect(poll._tag).toBe('Some')
      if (poll._tag === 'Some' && poll.value._tag === 'Failure') {
        const cause = poll.value.cause
        if (cause._tag === 'Fail') {
          expect((cause.error as LoadStalled)._tag).toBe('LoadStalled')
        }
      }
    }).pipe(runTest)
  })

  it('get(path) returns blob with bytes; isLoaded is true; screen absent from assets.toml loads nothing and succeeds', async () => {
    await Effect.gen(function* () {
      const bytes = new Uint8Array([11, 22, 33])
      const mock = fakeFetch({
        '/assets/sample.bin': { chunks: [bytes] },
      })
      const meter = yield* makeLoadMeter
      const assetsSource: AssetsSource = {
        screens: { sample: { files: ['/assets/sample.bin'] } },
      }
      const assets = yield* makeAssets({
        assets: assetsSource,
        fonts: {},
        fetch: mock.fetch,
        meter,
      })

      expect(assets.get('/assets/sample.bin')).toBeUndefined()
      expect(assets.isLoaded('sample')).toBe(false)

      yield* assets.load('sample')

      expect(assets.isLoaded('sample')).toBe(true)
      const blob = assets.get('/assets/sample.bin')
      expect(blob).toBeDefined()
      const buffer = yield* Effect.promise(() => blob!.arrayBuffer())
      expect(new Uint8Array(buffer)).toEqual(bytes)

      // Screen absent or no assets source
      expect(assets.isLoaded('nonexistent')).toBe(false)
      yield* assets.load('nonexistent')
      expect(assets.isLoaded('nonexistent')).toBe(true)

      const emptyAssets = yield* makeAssets({
        assets: undefined,
        fonts: {},
        fetch: mock.fetch,
        meter,
      })
      yield* emptyAssets.load('anyScreen')
      expect(emptyAssets.isLoaded('anyScreen')).toBe(true)
    }).pipe(runTest)
  })
})
