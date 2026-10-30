import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSeatTokenStore, SEAT_TOKEN_KEY, type SeatStorage, sessionSeatStorage } from './seat-token'

// The reconnection token (M7 spec §3, §4.2): a bearer credential for one seat, kept for one page load in
// sessionStorage, never localStorage and never the URL (FloorFifty `colyseus-network.ts` `remember`/`forget`).

function memoryStorage(): SeatStorage & { readonly items: Map<string, string> } {
  const items = new Map<string, string>()
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  }
}

const throwing: SeatStorage = {
  getItem: () => {
    throw new Error('blocked')
  },
  setItem: () => {
    throw new Error('blocked')
  },
  removeItem: () => {
    throw new Error('blocked')
  },
}

afterEach(() => vi.unstubAllGlobals())

describe('the seat token store', () => {
  it('writes the seat under its key and reads it back', () => {
    const storage = memoryStorage()
    const store = createSeatTokenStore(storage)
    store.write({ code: 'ABC234', token: 'token-1' })
    expect(storage.items.has(SEAT_TOKEN_KEY)).toBe(true)
    expect(store.read()).toEqual({ code: 'ABC234', token: 'token-1' })
  })

  it('forgets the seat', () => {
    const storage = memoryStorage()
    const store = createSeatTokenStore(storage)
    store.write({ code: 'ABC234', token: 'token-1' })
    store.forget()
    expect(store.read()).toBeUndefined()
    expect(storage.items.size).toBe(0)
  })

  it.each([
    ['not JSON', '{nope'],
    ['another shape', JSON.stringify({ roomCode: 'ABC234', reconnectionToken: 't' })],
    ['an extra field', JSON.stringify({ code: 'ABC234', token: 't', admin: true })],
    ['an empty token', JSON.stringify({ code: 'ABC234', token: '' })],
  ])('reads a stored value that is %s as nothing, and removes it', (_, raw) => {
    const storage = memoryStorage()
    storage.setItem(SEAT_TOKEN_KEY, raw)
    expect(createSeatTokenStore(storage).read()).toBeUndefined()
    expect(storage.items.size).toBe(0)
  })

  it('costs nothing when storage throws (private browsing, blocked site data)', () => {
    const store = createSeatTokenStore(throwing)
    expect(() => store.write({ code: 'ABC234', token: 't' })).not.toThrow()
    expect(store.read()).toBeUndefined()
    expect(() => store.forget()).not.toThrow()
  })

  it('uses sessionStorage, never localStorage', () => {
    const session = memoryStorage()
    const local = memoryStorage()
    vi.stubGlobal('sessionStorage', session)
    vi.stubGlobal('localStorage', local)
    createSeatTokenStore(sessionSeatStorage()).write({ code: 'ABC234', token: 't' })
    expect(session.items.has(SEAT_TOKEN_KEY)).toBe(true)
    expect(local.items.size).toBe(0)
  })

  it('works with no storage at all (a worker, Node)', () => {
    const store = createSeatTokenStore(undefined)
    store.write({ code: 'ABC234', token: 't' })
    expect(store.read()).toBeUndefined()
  })
})
