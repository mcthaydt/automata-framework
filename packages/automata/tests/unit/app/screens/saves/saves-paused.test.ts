import { describe, expect, it } from 'vitest'
import { statusOf } from '#src/app/screens/saves/saves-paused.ts'

// What paused says about the host's saves (M5 spec §7): nothing standalone, "no grant" under a host that did not grant
// them, and the host's own word otherwise.
describe('statusOf', () => {
  const granted = new Set(['saves'] as const)
  const none = new Set<'saves'>()

  it('says nothing standalone, where there is nothing to sync, whatever the SDK reports', () => {
    expect(statusOf({ kind: 'standalone', granted: none }, 'saved')).toBeUndefined()
    expect(statusOf({ kind: 'standalone', granted }, 'syncing')).toBeUndefined()
  })

  it('says no grant under a host that did not grant saves, rather than the SDK’s in-memory state', () => {
    expect(statusOf({ kind: 'ruken', granted: none }, 'saved')).toBe('no-grant')
    expect(statusOf({ kind: 'ruken', granted: none }, 'conflict')).toBe('no-grant')
  })

  it.each(['checking', 'syncing', 'saved', 'offline-queued', 'retry', 'conflict', 'recovered'] as const)(
    'passes the host’s %s through when saves were granted',
    (state) => {
      expect(statusOf({ kind: 'ruken', granted }, state)).toBe(state)
    },
  )
})
