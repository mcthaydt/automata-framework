import { afterEach, describe, expect, test, vi } from 'vitest'
import { domError } from '../../../testing/kit/fake-fs'
import {
  browserDownloadEnv,
  createDownloadStore,
  type DownloadEnv,
  type DownloadFile,
} from './download-store'

function fakeEnv(
  overrides: Partial<DownloadEnv> = {},
): DownloadEnv & { downloads: DownloadFile[]; shared: DownloadFile[] } {
  const downloads: DownloadFile[] = []
  const shared: DownloadFile[] = []
  return {
    downloads,
    shared,
    now: () => 9000,
    download: (file) => {
      downloads.push(file)
    },
    share: async (file) => {
      shared.push(file)
    },
    copyText: async () => undefined,
    ...overrides,
  }
}

const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes)

describe('download store', () => {
  test('is a download store', () => {
    expect(createDownloadStore(fakeEnv()).kind).toBe('download')
  })

  test('write starts a download named by the last path segment, and says ok', async () => {
    const env = fakeEnv()
    const store = createDownloadStore(env)
    expect(await store.write('stages/floor-1.toml', 'seed = 3')).toEqual({ ok: true, mtime: 9000 })
    expect(env.downloads).toHaveLength(1)
    expect(env.downloads[0]?.name).toBe('floor-1.toml')
    expect(text(env.downloads[0]?.data ?? new Uint8Array())).toBe('seed = 3')
  })

  test('the file type follows the extension', async () => {
    const env = fakeEnv()
    const store = createDownloadStore(env)
    await store.write('a.json', '{}')
    await store.write('b.toml', '')
    await store.write('c.txt', '')
    await store.write('d.unknown', '')
    await store.write('E.JSON', '{}')
    await store.write('.toml', '')
    expect(env.downloads.map((file) => file.type)).toEqual([
      'application/json',
      'application/toml',
      'text/plain',
      'application/octet-stream',
      'application/json',
      'application/octet-stream',
    ])
  })

  test('bytes are copied, not shared with the caller', async () => {
    const env = fakeEnv()
    const bytes = new Uint8Array([1, 2, 3])
    await createDownloadStore(env).write('a.bin', bytes)
    bytes.fill(0)
    expect([...(env.downloads[0]?.data ?? [])]).toEqual([1, 2, 3])
  })

  test('a download that throws is a failed write, not a crash', async () => {
    const store = createDownloadStore(
      fakeEnv({
        download: () => {
          throw new Error('blocked by the browser')
        },
      }),
    )
    expect(await store.write('a.txt', 'x')).toEqual({
      ok: false,
      reason: 'io',
      message: 'blocked by the browser',
    })
  })

  test('it keeps nothing: read is undefined, list is empty, remove does nothing', async () => {
    const store = createDownloadStore(fakeEnv())
    await store.write('a.txt', 'x')
    expect(await store.read('a.txt')).toBeUndefined()
    expect(await store.list()).toEqual([])
    await expect(store.remove('a.txt')).resolves.toBeUndefined()
  })

  test('a bad path is refused like in every store', async () => {
    const store = createDownloadStore(fakeEnv())
    await expect(store.write('../x', 'no')).rejects.toBeInstanceOf(RangeError)
    await expect(store.read('/x')).rejects.toBeInstanceOf(RangeError)
  })

  describe('share', () => {
    test('canShare follows the environment', () => {
      expect(createDownloadStore(fakeEnv()).canShare).toBe(true)
      expect(createDownloadStore(fakeEnv({ share: undefined })).canShare).toBe(false)
    })

    test('opens the share sheet with the file', async () => {
      const env = fakeEnv()
      const store = createDownloadStore(env)
      expect(await store.share('stages/a.toml', 'x = 1')).toEqual({ ok: true, mtime: 9000 })
      expect(env.shared.map((file) => file.name)).toEqual(['a.toml'])
      expect(env.downloads).toEqual([])
    })

    test('a dismissed sheet is a cancelled export, not an error', async () => {
      const store = createDownloadStore(
        fakeEnv({
          share: async () => {
            throw domError('AbortError', 'Share canceled')
          },
        }),
      )
      expect(await store.share('a.txt', 'x')).toEqual({
        ok: false,
        reason: 'denied',
        message: 'Export cancelled',
      })
    })

    test('another failure keeps its reason and message', async () => {
      const store = createDownloadStore(
        fakeEnv({
          share: async () => {
            throw domError('NotAllowedError', 'Sharing needs a tap.')
          },
        }),
      )
      expect(await store.share('a.txt', 'x')).toEqual({
        ok: false,
        reason: 'denied',
        message: 'Sharing needs a tap.',
      })
    })

    test('without a share sheet it fails clearly instead of downloading behind the person’s back', async () => {
      const env = fakeEnv({ share: undefined })
      const result = await createDownloadStore(env).share('a.txt', 'x')
      expect(result).toMatchObject({ ok: false, reason: 'io' })
      expect(env.downloads).toEqual([])
    })
  })

  describe('copyText', () => {
    test('puts text on the clipboard', async () => {
      const copy = vi.fn(async () => undefined)
      const store = createDownloadStore(fakeEnv({ copyText: copy }))
      expect(await store.copyText('hello')).toEqual({ ok: true, mtime: 9000 })
      expect(copy).toHaveBeenCalledWith('hello')
    })

    test('a refused clipboard is denied', async () => {
      const store = createDownloadStore(
        fakeEnv({
          copyText: async () => {
            throw domError('NotAllowedError', 'Clipboard write was blocked.')
          },
        }),
      )
      expect(await store.copyText('x')).toEqual({
        ok: false,
        reason: 'denied',
        message: 'Clipboard write was blocked.',
      })
    })

    test('no clipboard is io', async () => {
      expect(await createDownloadStore(fakeEnv({ copyText: undefined })).copyText('x')).toMatchObject({
        ok: false,
        reason: 'io',
      })
    })
  })
})

describe('browserDownloadEnv', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function pageWith(share?: (data: ShareData) => Promise<void>, canShare?: (data: ShareData) => boolean) {
    const clicks: HTMLAnchorElement[] = []
    const revoked: string[] = []
    const timers: Array<() => void> = []
    const waits: number[] = []
    const env = browserDownloadEnv({
      document,
      urls: {
        createObjectURL: () => 'blob:fake-1',
        revokeObjectURL: (url) => {
          revoked.push(url)
        },
      },
      navigator: { share, canShare, clipboard: { writeText: async () => undefined } },
      setTimer: (run, ms) => {
        timers.push(run)
        waits.push(ms)
      },
      now: () => 4242,
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this)
    })
    return { env, clicks, revoked, timers, waits }
  }

  test('download clicks a temporary link with the file name, then cleans it up', () => {
    const { env, clicks, revoked, timers, waits } = pageWith()
    env.download({ name: 'a.toml', type: 'application/toml', data: new Uint8Array([1]) })
    expect(clicks).toHaveLength(1)
    expect(clicks[0]?.download).toBe('a.toml')
    expect(clicks[0]?.getAttribute('href')).toBe('blob:fake-1')
    expect(document.querySelector('a[download]')).toBeNull()
    expect(revoked).toEqual([])
    expect(waits[0]).toBeGreaterThanOrEqual(10_000)
    for (const run of timers) run()
    expect(revoked).toEqual(['blob:fake-1'])
  })

  test('has no share when the browser cannot share files', () => {
    expect(pageWith(undefined, undefined).env.share).toBeUndefined()
    expect(
      pageWith(
        async () => undefined,
        () => false,
      ).env.share,
    ).toBeUndefined()
  })

  test('calls the navigator and clipboard methods on their objects, as macOS WebKit requires', async () => {
    // WebKit's `canShare`, `share` and `writeText` throw "Can only call Navigator.canShare on instances of
    // Navigator" when called detached from their object (seen on the Mac's parity run, EDK.6a).
    const shared: ShareData[] = []
    const copied: string[] = []
    const clipboard = {
      async writeText(this: unknown, text: string) {
        if (this !== clipboard)
          throw new TypeError('Can only call Clipboard.writeText on instances of Clipboard')
        copied.push(text)
      },
    }
    const navigatorLike = {
      async share(this: unknown, data: ShareData) {
        if (this !== navigatorLike)
          throw new TypeError('Can only call Navigator.share on instances of Navigator')
        shared.push(data)
      },
      canShare(this: unknown, _data: ShareData) {
        if (this !== navigatorLike)
          throw new TypeError('Can only call Navigator.canShare on instances of Navigator')
        return true
      },
      clipboard,
    }
    const env = browserDownloadEnv({
      document,
      urls: { createObjectURL: () => 'blob:fake-1', revokeObjectURL: () => undefined },
      navigator: navigatorLike,
      setTimer: () => undefined,
      now: () => 4242,
    })
    await env.share?.({ name: 'a.toml', type: 'application/toml', data: new Uint8Array([1]) })
    await env.copyText?.('copied')
    expect(shared).toHaveLength(1)
    expect(copied).toEqual(['copied'])
  })

  test('shares a file when the browser can', async () => {
    const shared: ShareData[] = []
    const { env } = pageWith(
      async (data) => {
        shared.push(data)
      },
      () => true,
    )
    await env.share?.({ name: 'a.toml', type: 'application/toml', data: new Uint8Array([1]) })
    expect(shared).toHaveLength(1)
    expect(shared[0]?.files?.[0]?.name).toBe('a.toml')
  })
})
