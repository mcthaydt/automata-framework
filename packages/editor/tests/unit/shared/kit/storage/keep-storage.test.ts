// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { openSuitePorts } from '#src/features/suite/shell/open-suite-ports.ts'
import { SAMPLE_GAME } from '#src/features/suite/shell/sample-ports.ts'
import { keepStorage } from '#src/shared/kit/storage/keep-storage.ts'
import { saveLine } from '#src/shared/kit/storage/save-line.ts'

// The browser may clear a site's files when space runs short, unless the site asked to keep them: the first write of
// a page asks once, and the answer is not shown, because it changes nothing the person does.

describe('keepStorage', () => {
  it('asks to keep the storage once when it is not kept yet', async () => {
    const persist = vi.fn(() => Promise.resolve(true))
    const keep = keepStorage({ persisted: () => Promise.resolve(false), persist })
    await keep()
    await keep()
    expect(persist).toHaveBeenCalledOnce()
  })

  it('does not ask when the storage is already kept', async () => {
    const persist = vi.fn(() => Promise.resolve(true))
    await keepStorage({ persisted: () => Promise.resolve(true), persist })()
    expect(persist).not.toHaveBeenCalled()
  })

  it('swallows a refusal, and a browser with no such call', async () => {
    await expect(
      keepStorage({
        persisted: () => Promise.resolve(false),
        persist: () => Promise.reject(new Error('no')),
      })(),
    ).resolves.toBeUndefined()
    await expect(keepStorage({})()).resolves.toBeUndefined()
    await expect(keepStorage(undefined)()).resolves.toBeUndefined()
  })
})

// A private window or a full disk: the browser refuses to keep the files. The page says so in the saved line, and what
// is typed goes nowhere else (no other store stands in), so a person is never told the work is safe when it is not.
describe('a browser that refuses to keep the files', () => {
  const refusing = {
    persisted: () => Promise.resolve(false),
    persist: () => Promise.resolve(false),
    getDirectory: () => Promise.reject(new DOMException('The disk is full.', 'QuotaExceededError')),
  }
  const noServer = {
    origin: 'http://127.0.0.1:4173',
    search: '',
    fetch: (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch,
    storage: refusing,
  }

  it('says the words are not kept, and writes to no other store', async () => {
    localStorage.clear()
    await keepStorage(refusing)()
    const opened = await openSuitePorts(noServer)
    expect(opened).toMatchObject({ sample: true, kept: false })
    expect(saveLine({ pending: 0, where: opened.kept ? 'device' : 'nowhere' })).toEqual({
      state: 'failed',
      words: 'Not saved: this browser can’t keep your work. It is lost when this page closes.',
    })
    // A change made now lives in memory for this page only: nothing reaches the device, and a later page starts over.
    const path = 'content/tuning.toml'
    const before = await opened.ports.workspace.read(path)
    await opened.ports.workspace.write(path, 'changed = true\n', { mtime: before?.mtime ?? 0 })
    expect(localStorage.length).toBe(0)
    const again = await openSuitePorts(noServer)
    expect((await again.ports.workspace.read(path))?.text).toBe(SAMPLE_GAME[path])
  })
})
