import type { AssetsSource } from '@automata/content'
import { describe, expect, it, vi } from 'vitest'
import type { Result } from '#src/shared/lib/result.ts'
import { createAssets } from '#src/shared/runtime/assets.manager.ts'
import { AssetLoadFailed, LoadStalled } from '#src/shared/runtime/boot-error.ts'
import { createLoadMeter } from '#src/shared/runtime/load-meter.ts'
import { fakeClock } from '#src/testing/fake-clock.ts'
import { fakeFetch } from '#src/testing/runtime/fake-fetch.ts'
import { settle } from '#src/testing/settle.ts'

/** Follows a load so a test can ask whether it has finished yet, and with what. */
function watch<A>(promise: Promise<A>): { readonly result: () => A | undefined } {
  let result: A | undefined
  void promise.then((value) => {
    result = value
  })
  return { result: () => result }
}

/** The reason of a refused load; fails the test when the load succeeded. */
function reasonOf<R>(result: Result<void, R> | undefined): R {
  if (result === undefined || result.ok)
    throw new Error(`expected a refused load, got ${JSON.stringify(result)}`)
  return result.reason
}

describe('Assets', () => {
  it('single flight: two load("title") and one load("menu") sharing a.png make one request for a.png', async () => {
    const mock = fakeFetch({
      '/assets/a.png': { chunks: [new Uint8Array([1, 2])] },
      '/assets/b.png': { chunks: [new Uint8Array([3, 4])] },
    })
    const clock = fakeClock()
    const meter = createLoadMeter(clock)
    const assetsSource: AssetsSource = {
      screens: {
        title: { files: ['/assets/a.png', '/assets/b.png'] },
        menu: { files: ['/assets/a.png'] },
      },
    }
    const assets = createAssets({
      assets: assetsSource,
      fonts: {},
      fetch: mock.fetch,
      meter,
    })

    const loads = await Promise.all([assets.load('title'), assets.load('title'), assets.load('menu')])
    expect(loads.every((load) => load.ok)).toBe(true)

    expect(mock.requests.filter((r) => r === '/assets/a.png')).toHaveLength(1)
    expect(mock.requests.filter((r) => r === '/assets/b.png')).toHaveLength(1)
    expect(assets.isLoaded('title')).toBe(true)
    expect(assets.isLoaded('menu')).toBe(true)
  })

  it('shared progress: two waiters hear the same fractions; undefined before first byte', async () => {
    const chunk1 = new Uint8Array([1, 2])
    const chunk2 = new Uint8Array([3, 4])
    const mock = fakeFetch({
      '/assets/big.bin': {
        chunks: [chunk1, chunk2],
        contentLength: 4,
      },
    })
    const clock = fakeClock()
    const meter = createLoadMeter(clock)
    const assetsSource: AssetsSource = {
      screens: {
        main: { files: ['/assets/big.bin'] },
      },
    }
    const assets = createAssets({
      assets: assetsSource,
      fonts: {},
      fetch: mock.fetch,
      meter,
    })

    const progress1: (number | undefined)[] = []
    const progress2: (number | undefined)[] = []

    await Promise.all([
      assets.load('main', (p) => progress1.push(p)),
      assets.load('main', (p) => progress2.push(p)),
    ])

    expect(progress1).toEqual(progress2)
    expect(progress1[progress1.length - 1]).toBe(1)
  })

  it('a failed file is not remembered: 404 then a fixed route -> next load requests again and succeeds', async () => {
    let is404 = true
    const mockFetch: typeof fetch = async (_input, _init) => {
      if (is404) {
        return new Response('Not found', { status: 404 })
      }
      return new Response(new Uint8Array([1, 2, 3]), { status: 200 })
    }
    const clock = fakeClock()
    const meter = createLoadMeter(clock)
    const assetsSource: AssetsSource = {
      screens: { title: { files: ['/assets/retry.png'] } },
    }
    const assets = createAssets({
      assets: assetsSource,
      fonts: {},
      fetch: mockFetch,
      meter,
    })

    const firstResult = reasonOf(await assets.load('title'))
    expect(firstResult).toBeInstanceOf(AssetLoadFailed)
    expect((firstResult as AssetLoadFailed).status).toBe(404)
    expect(assets.isLoaded('title')).toBe(false)

    is404 = false
    expect((await assets.load('title')).ok).toBe(true)
    expect(assets.isLoaded('title')).toBe(true)
    expect(assets.get('/assets/retry.png')?.size).toBe(3)
  })

  it('non-OK status fails AssetLoadFailed{url, status: 404}; network error fails with status: 0', async () => {
    const mock = fakeFetch({
      '/assets/bad.png': { status: 404 },
      '/assets/net.png': { networkError: true },
    })
    const clock = fakeClock()
    const meter = createLoadMeter(clock)
    const assetsSource: AssetsSource = {
      screens: {
        s1: { files: ['/assets/bad.png'] },
        s2: { files: ['/assets/net.png'] },
      },
    }
    const assets = createAssets({
      assets: assetsSource,
      fonts: {},
      fetch: mock.fetch,
      meter,
    })

    const err1 = reasonOf(await assets.load('s1'))
    expect(err1).toBeInstanceOf(AssetLoadFailed)
    expect((err1 as AssetLoadFailed).status).toBe(404)
    expect((err1 as AssetLoadFailed).url).toBe('/assets/bad.png')

    const err2 = reasonOf(await assets.load('s2'))
    expect(err2).toBeInstanceOf(AssetLoadFailed)
    expect((err2 as AssetLoadFailed).status).toBe(0)
    expect((err2 as AssetLoadFailed).url).toBe('/assets/net.png')
  })

  it('chunks feed the meter: a file sending a chunk every 10s for 60s does not stall', async () => {
    const clock = fakeClock()
    const meter = createLoadMeter(clock)
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
    const assets = createAssets({
      assets: assetsSource,
      fonts: {},
      fetch: mockFetch,
      meter,
    })

    const loading = assets.load('streamScreen')

    for (let i = 0; i < 6; i++) {
      clock.advance(10000)
      await settle()
      controllerRef?.enqueue(new Uint8Array([i]))
    }
    controllerRef?.close()

    expect((await loading).ok).toBe(true)
    expect(assets.isLoaded('streamScreen')).toBe(true)
  })

  it('a file that goes quiet fails LoadStalled at 30s with its bytesSoFar, and fakeFetch.aborted lists it', async () => {
    const mock = fakeFetch({
      '/assets/hang.bin': {
        chunks: [new Uint8Array([1, 2, 3])],
        hang: true,
        contentLength: 100,
      },
    })
    const clock = fakeClock()
    const meter = createLoadMeter(clock)
    const assetsSource: AssetsSource = {
      screens: { hungScreen: { files: ['/assets/hang.bin'] } },
    }
    const assets = createAssets({
      assets: assetsSource,
      fonts: {},
      fetch: mock.fetch,
      meter,
    })

    const loading = watch(assets.load('hungScreen'))
    // The first chunk arrives at time 0; from then on the file goes quiet.
    await settle()

    clock.advance(29_999)
    await settle()
    expect(loading.result()).toBeUndefined()

    clock.advance(1)
    await settle()
    const err = reasonOf(loading.result()) as LoadStalled
    expect(err).toBeInstanceOf(LoadStalled)
    expect(err._tag).toBe('LoadStalled')
    expect(err.url).toBe('/assets/hang.bin')
    expect(err.bytesSoFar).toBe(3)
    expect(err.stalledMs).toBe(30_000)
    expect(mock.aborted).toContain('/assets/hang.bin')
  })

  it('aborting a load aborts the fetch in flight', async () => {
    const mock = fakeFetch({
      '/assets/slow.bin': {
        hang: true,
      },
    })
    const clock = fakeClock()
    const meter = createLoadMeter(clock)
    const assetsSource: AssetsSource = {
      screens: { slowScreen: { files: ['/assets/slow.bin'] } },
    }
    const assets = createAssets({
      assets: assetsSource,
      fonts: {},
      fetch: mock.fetch,
      meter,
    })

    const controller = new AbortController()
    const loading = assets.load('slowScreen', undefined, controller.signal)
    clock.advance(5000)
    await settle()
    controller.abort()
    await expect(loading).rejects.toThrow()

    expect(mock.aborted).toContain('/assets/slow.bin')
  })

  it('fonts: a screen fonts are awaited through injected fonts.load; isLoaded is false until both files and fonts finish; stalls at 30s', async () => {
    const mock = fakeFetch({
      '/assets/font-test.png': { chunks: [new Uint8Array([1])] },
    })
    const clock = fakeClock()
    const meter = createLoadMeter(clock)
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
    const assets = createAssets({
      assets: assetsSource,
      fonts: { withFonts: ['16px CustomFont'] },
      fetch: mock.fetch,
      fontFaces,
      meter,
    })

    const loading = assets.load('withFonts')
    clock.advance(100)
    await settle()
    expect(fontFaces.load).toHaveBeenCalledWith('16px CustomFont')
    expect(assets.isLoaded('withFonts')).toBe(false)

    resolveFont()
    expect((await loading).ok).toBe(true)
    expect(assets.isLoaded('withFonts')).toBe(true)

    // Test font load stall
    const neverEndingFontFaces = {
      load: vi.fn(() => new Promise<never>(() => undefined)),
    }
    const stallAssets = createAssets({
      assets: assetsSource,
      fonts: { withFonts: ['16px BrokenFont'] },
      fetch: mock.fetch,
      fontFaces: neverEndingFontFaces,
      meter,
    })

    const stalling = watch(stallAssets.load('withFonts'))
    clock.advance(30000)
    await settle()
    expect(reasonOf(stalling.result())).toBeInstanceOf(LoadStalled)
  })

  it('get(path) returns blob with bytes; isLoaded is true; screen absent from assets.toml loads nothing and succeeds', async () => {
    const bytes = new Uint8Array([11, 22, 33])
    const mock = fakeFetch({
      '/assets/sample.bin': { chunks: [bytes] },
    })
    const clock = fakeClock()
    const meter = createLoadMeter(clock)
    const assetsSource: AssetsSource = {
      screens: { sample: { files: ['/assets/sample.bin'] } },
    }
    const assets = createAssets({
      assets: assetsSource,
      fonts: {},
      fetch: mock.fetch,
      meter,
    })

    expect(assets.get('/assets/sample.bin')).toBeUndefined()
    expect(assets.isLoaded('sample')).toBe(false)

    expect((await assets.load('sample')).ok).toBe(true)

    expect(assets.isLoaded('sample')).toBe(true)
    const blob = assets.get('/assets/sample.bin')
    expect(blob).toBeDefined()
    const buffer = await blob!.arrayBuffer()
    expect(new Uint8Array(buffer)).toEqual(bytes)

    // Screen absent or no assets source
    expect(assets.isLoaded('nonexistent')).toBe(false)
    expect((await assets.load('nonexistent')).ok).toBe(true)
    expect(assets.isLoaded('nonexistent')).toBe(true)

    const emptyAssets = createAssets({
      assets: undefined,
      fonts: {},
      fetch: mock.fetch,
      meter,
    })
    expect((await emptyAssets.load('anyScreen')).ok).toBe(true)
    expect(emptyAssets.isLoaded('anyScreen')).toBe(true)
  })
})
