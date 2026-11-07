import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createSeatTokenStore,
  type SeatOwner,
  type SeatStorage,
  seatTokenKey,
  sessionSeatStorage,
} from './seat-token'

// The reconnection token (M7 spec §3, §4.2): a bearer credential for one seat, kept for one page load in
// sessionStorage, never localStorage and never the URL (FloorFifty `colyseus-network.ts` `remember`/`forget`). Kept
// in memory too, written through, so a client with no storage (a worker, Node, blocked site data) still reconnects.
// Stored per server: on itch.io every game shares one origin, so one game's seat must never reach another's server.

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

const OWNER: SeatOwner = {
  url: 'wss://a.test',
  schemaHash: '0123456789abcdef',
  contentHash: 'fedcba9876543210',
}
const KEY = seatTokenKey(OWNER.url)
const SEAT = { code: 'ABC234', token: 'ABC234:t' }

afterEach(() => vi.unstubAllGlobals())

describe('the seat token store', () => {
  it('writes the seat under its server’s key and reads it back', () => {
    const storage = memoryStorage()
    createSeatTokenStore(storage, OWNER).write(SEAT)
    expect(JSON.parse(storage.items.get(KEY) as string)).toEqual({ ...OWNER, ...SEAT })
    // A new page load (a new store) reads it from storage.
    expect(createSeatTokenStore(storage, OWNER).read()).toEqual(SEAT)
  })

  it('forgets the seat', () => {
    const storage = memoryStorage()
    const store = createSeatTokenStore(storage, OWNER)
    store.write(SEAT)
    store.forget()
    expect(store.read()).toBeUndefined()
    expect(storage.items.size).toBe(0)
  })

  it.each([
    ['not JSON', '{nope'],
    ['another shape', JSON.stringify({ roomCode: 'ABC234', reconnectionToken: 't' })],
    ['an extra field', JSON.stringify({ ...OWNER, ...SEAT, admin: true })],
    ['an empty token', JSON.stringify({ ...OWNER, ...SEAT, token: '' })],
  ])('reads a stored value that is %s as nothing, and removes it', (_, raw) => {
    const storage = memoryStorage()
    storage.setItem(KEY, raw)
    expect(createSeatTokenStore(storage, OWNER).read()).toBeUndefined()
    expect(storage.items.size).toBe(0)
  })

  it("never reads another server's seat, and leaves it where it is", () => {
    const storage = memoryStorage()
    createSeatTokenStore(storage, OWNER).write(SEAT)
    const other = createSeatTokenStore(storage, { ...OWNER, url: 'wss://b.test' })
    expect(other.read()).toBeUndefined()
    other.forget()
    expect(createSeatTokenStore(storage, OWNER).read()).toEqual(SEAT)
  })

  it('reads a seat stored by another build of the game as nothing, without deleting it', () => {
    const storage = memoryStorage()
    createSeatTokenStore(storage, OWNER).write(SEAT)
    expect(
      createSeatTokenStore(storage, { ...OWNER, contentHash: '1111111111111111' }).read(),
    ).toBeUndefined()
    expect(createSeatTokenStore(storage, { ...OWNER, schemaHash: '1111111111111111' }).read()).toBeUndefined()
    expect(storage.items.has(KEY)).toBe(true)
  })

  it('uses sessionStorage, never localStorage', () => {
    const session = memoryStorage()
    const local = memoryStorage()
    vi.stubGlobal('sessionStorage', session)
    vi.stubGlobal('localStorage', local)
    createSeatTokenStore(sessionSeatStorage(), OWNER).write(SEAT)
    expect(session.items.has(KEY)).toBe(true)
    expect(local.items.size).toBe(0)
  })

  it.each([
    ['throws', throwing],
    ['is missing', undefined],
  ])('keeps the seat in memory when storage %s', (_, storage) => {
    const store = createSeatTokenStore(storage, OWNER)
    expect(() => store.write(SEAT)).not.toThrow()
    expect(store.read()).toEqual(SEAT)
    expect(() => store.forget()).not.toThrow()
    expect(store.read()).toBeUndefined()
  })

  it('reads its own memory before storage', () => {
    const storage = memoryStorage()
    const store = createSeatTokenStore(storage, OWNER)
    store.write(SEAT)
    storage.items.clear()
    expect(store.read()).toEqual(SEAT)
  })
})
