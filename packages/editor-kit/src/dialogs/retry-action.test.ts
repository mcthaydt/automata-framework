import { describe, expect, it, vi } from 'vitest'
import type { FolderStore } from '../storage/folder'
import { createMemoryStore } from '../storage/memory-store'
import { createTestClock } from '../testing/test-clock'
import { createToasts } from '../widgets/toasts'
import { retryAction } from './retry-action'

// The action a failed save or open offers (plan ED2D.4c2b, decision 6; moved from editor-2d in ED3D.5c; kit spec §6 "Folder permission revoked"): Retry,
// or Re-grant when the store is a folder whose permission lapsed, which asks the browser again and then retries.

function folderStore(granted: boolean): FolderStore {
  return {
    ...createMemoryStore(),
    kind: 'folder',
    name: 'my-game',
    requestAccess: vi.fn(async () => granted),
  }
}

const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('retryAction', () => {
  it('is Retry for a store that is not a folder, whatever the reason', async () => {
    const retry = vi.fn(async () => {})
    const toasts = createToasts({ clock: createTestClock() })
    const action = retryAction({ store: createMemoryStore(), reason: 'denied', toasts, retry })
    expect(action.label).toBe('Retry')
    action.run()
    await settle()
    expect(retry).toHaveBeenCalledOnce()
  })

  it('is Retry for a folder when the reason is not a denied permission', () => {
    const toasts = createToasts({ clock: createTestClock() })
    const action = retryAction({ store: folderStore(true), reason: 'quota', toasts, retry: async () => {} })
    expect(action.label).toBe('Retry')
  })

  it('is Re-grant for a folder that denied: it asks again and, granted, retries', async () => {
    const store = folderStore(true)
    const retry = vi.fn(async () => {})
    const toasts = createToasts({ clock: createTestClock() })
    const action = retryAction({ store, reason: 'denied', toasts, retry })
    expect(action.label).toBe('Re-grant')
    action.run()
    await settle()
    expect(store.requestAccess).toHaveBeenCalledOnce()
    expect(retry).toHaveBeenCalledOnce()
    expect(toasts.items).toEqual([])
  })

  it('a Re-grant that is refused retries nothing and says the edits are kept', async () => {
    const retry = vi.fn(async () => {})
    const toasts = createToasts({ clock: createTestClock() })
    retryAction({ store: folderStore(false), reason: 'denied', toasts, retry }).run()
    await settle()
    expect(retry).not.toHaveBeenCalled()
    expect(toasts.items).toEqual([
      expect.objectContaining({
        kind: 'error',
        message: 'Access to my-game was not granted. Nothing was lost: your edits are still here.',
      }),
    ])
  })
})
