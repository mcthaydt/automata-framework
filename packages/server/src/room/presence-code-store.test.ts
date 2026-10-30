import { LocalPresence } from '@colyseus/core'
import { describe, expect, it } from 'vitest'
import { presenceCodeStore } from './presence-code-store'

// The room-code claim (M7.3a room-code.ts) is the shared set's add: 1 when added, 0 when held. Colyseus's
// single-process LocalPresence answers its add with nothing, so the room claims through this adapter.

describe('presenceCodeStore', () => {
  it('reports whether a single-process presence added the code', async () => {
    const store = presenceCodeStore(new LocalPresence())
    expect(await store.sadd('codes', 'ABCDEF')).toBe(1)
    expect(await store.sadd('codes', 'ABCDEF')).toBe(0)
    await store.srem('codes', 'ABCDEF')
    expect(await store.sadd('codes', 'ABCDEF')).toBe(1)
  })

  it("passes a shared presence's own answer through", async () => {
    const shared = { sadd: async () => 0, srem: async () => 1 }
    expect(await presenceCodeStore(shared as never).sadd('codes', 'ABCDEF')).toBe(0)
  })
})
