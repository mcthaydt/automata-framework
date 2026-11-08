import { describe, expect, it, vi } from 'vitest'
import { keepStorage } from '#src/shared/kit/storage/keep-storage.ts'

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
