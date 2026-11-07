import { afterEach, describe, expect, it } from 'vitest'
import type { NetSdkClient, NetSdkRoom } from '#src/features/client/room/sdk.ts'
import { type SeatStorage, seatTokenKey } from '#src/features/client/room/seat-token.ts'
import type { FakeRoom } from '#src/testing/fake-colyseus.ts'
import {
  GRACE_SECONDS,
  type Harness,
  memoryStorage,
  outcome,
  rejected,
  SEAT_KEY,
  startHarness,
  storedSeat,
} from '#src/testing/net-room-harness.ts'

// The cases the PR #13 review found: storage that fails, a seat stored for another server, handshakes that
// never settle, a room closed mid-reconnect, and an aborted resume. A fake clock throughout.

let harnesses: Harness[] = []
afterEach(async () => {
  for (const h of harnesses) await h.close()
  harnesses = []
})
const start = async (...args: Parameters<typeof startHarness>) => {
  const h = await startHarness(...args)
  harnesses.push(h)
  return h
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

const never = () => new Promise<FakeRoom>(() => undefined)

describe('a drop with no working storage', () => {
  it.each([
    ['throws', throwing],
    ['is switched off (a worker, a headless client)', null],
  ])('reconnects into its seat when storage %s', async (_, storage) => {
    const h = await start({ storage })
    await h.room.create({ name: 'Ada' })
    const token = h.fake.rooms[0]?.reconnectionToken
    h.fake.rooms[0]?.close(1006)
    await h.settle()
    expect(h.fake.calls.at(-1)).toEqual({ method: 'reconnect', args: [token] })
    expect(h.connection()).toBe('connected')
    expect(h.ended()).toBeUndefined()
  })
})

describe('a seat stored for another server', () => {
  it('is never presented here, and is not deleted by this server’s resume', async () => {
    const storage = memoryStorage()
    const otherKey = seatTokenKey('wss://other-game.test')
    storage.setItem(otherKey, storedSeat('ABC234', 'ABC234:theirs', 'wss://other-game.test'))
    // Even a record planted under this server's key for another url is not presented.
    storage.setItem(SEAT_KEY, storedSeat('XYZ789', 'XYZ789:theirs', 'wss://other-game.test'))
    const h = await start({ storage })
    expect(await h.room.resume()).toBe('none')
    expect(h.fake.calls).toEqual([])
    expect(storage.items.get(otherKey)).toBe(storedSeat('ABC234', 'ABC234:theirs', 'wss://other-game.test'))
  })

  it("survives this server's resume forgetting an expired seat of its own", async () => {
    const storage = memoryStorage()
    const otherKey = seatTokenKey('wss://other-game.test')
    const theirs = storedSeat('ABC234', 'ABC234:theirs', 'wss://other-game.test')
    storage.setItem(otherKey, theirs)
    storage.setItem(SEAT_KEY, storedSeat('XYZ789', 'XYZ789:ours'))
    const h = await start({ storage })
    h.fake.respond('reconnect', new Error('reconnection token invalid or expired.'))
    expect(await h.room.resume()).toBe('expired')
    expect(storage.items.has(SEAT_KEY)).toBe(false)
    expect(storage.items.get(otherKey)).toBe(theirs)
  })

  it("survives a leave when another build's seat sits under this server's key", async () => {
    const storage = memoryStorage()
    const otherBuild = JSON.stringify({
      url: 'ws://server.test',
      schemaHash: '1111111111111111',
      contentHash: '2222222222222222',
      code: 'ABC234',
      token: 'ABC234:other-build',
    })
    storage.setItem(SEAT_KEY, otherBuild)
    const h = await start({ storage })
    await h.room.leave()
    expect(storage.items.get(SEAT_KEY)).toBe(otherBuild)
  })
})

describe('a late room for a retired intent', () => {
  it('a double-tapped join leaves the first room and keeps the second seat’s token', async () => {
    const h = await start()
    let arrive!: (room: FakeRoom) => void
    h.fake.respond('joinById', new Promise<FakeRoom>((resolve) => (arrive = resolve)))
    const first = outcome(h.room.join('XYZ789', { name: 'Ada' }))
    await h.settle()
    await h.room.join('XYZ789', { name: 'Ada' })
    const second = h.fake.rooms.at(-1) as FakeRoom
    const late = h.fake.room('XYZ789')
    arrive(late)
    await first
    await h.settle()
    expect(late.leaves).toEqual([true])
    expect(late.closes).toBe(0)
    expect(JSON.parse(h.items.get(SEAT_KEY) as string)).toMatchObject({ token: second.reconnectionToken })
    expect(h.connection()).toBe('connected')
  })

  it('a reconnect overtaken by a fresh join of the same room is left, not kept', async () => {
    const h = await start()
    await h.room.join('XYZ789', { name: 'Ada' })
    let arrive!: (room: FakeRoom) => void
    h.fake.respond('reconnect', new Promise<FakeRoom>((resolve) => (arrive = resolve)))
    h.fake.rooms[0]?.close(1006)
    await h.settle()
    await h.room.join('XYZ789', { name: 'Ada' })
    const joined = h.fake.rooms.at(-1) as FakeRoom
    const late = h.fake.room('XYZ789')
    arrive(late)
    await h.settle()
    expect(late.leaves).toEqual([true])
    expect(late.closes).toBe(0)
    expect(JSON.parse(h.items.get(SEAT_KEY) as string)).toMatchObject({ token: joined.reconnectionToken })
  })
})

describe('a reconnect attempt that hangs', () => {
  it('is given up after 5 s, and the next attempt reconnects well inside the grace', async () => {
    const h = await start()
    await h.room.create({ name: 'Ada' })
    let arrive!: (room: FakeRoom) => void
    h.fake.respond('reconnect', new Promise<FakeRoom>((resolve) => (arrive = resolve)))
    h.fake.rooms[0]?.close(1006)
    await h.advance(6_000)
    expect(h.connection()).toBe('connected')
    expect(h.fake.calls.filter((call) => call.method === 'reconnect')).toHaveLength(2)
    const current = h.fake.rooms.at(-1) as FakeRoom
    // The abandoned attempt's room arrives after all: retired, never adopted over the current one.
    const late = h.fake.room('ABC234')
    arrive(late)
    await h.settle()
    expect(late.leaves).toEqual([true])
    expect(JSON.parse(h.items.get(SEAT_KEY) as string)).toMatchObject({ token: current.reconnectionToken })
    current.message({ t: 'seated', seat: 0 })
    expect(h.info()?.you).toBe(0)
  })
})

describe('handshakes that never settle', () => {
  it('give the seat up when the grace passes, even mid-attempt', async () => {
    const h = await start()
    await h.room.create({ name: 'Ada' })
    h.fake.respondAlways('reconnect', never())
    h.fake.rooms[0]?.close(1006)
    await h.advance(GRACE_SECONDS * 1000 + 250)
    expect(h.ended()).toEqual({ reason: 'seat-lost' })
    expect(h.connection()).toBe('offline')
  })

  it('a room that arrives after the grace is left', async () => {
    const h = await start()
    await h.room.create({ name: 'Ada' })
    let arrive!: (room: FakeRoom) => void
    h.fake.respond('reconnect', new Promise<FakeRoom>((resolve) => (arrive = resolve)))
    h.fake.respondAlways('reconnect', never())
    h.fake.rooms[0]?.close(1006)
    await h.advance(GRACE_SECONDS * 1000 + 250)
    const late = h.fake.room()
    arrive(late)
    await h.settle()
    expect(late.leaves).toEqual([true])
    expect(h.connection()).toBe('offline')
  })

  it('bound a resume: offline after the grace, the seat kept for a later load', async () => {
    const storage = memoryStorage()
    storage.setItem(SEAT_KEY, storedSeat('ABC234', 'ABC234:held'))
    const h = await start({ storage })
    let arrive!: (room: FakeRoom) => void
    h.fake.respond('reconnect', new Promise<FakeRoom>((resolve) => (arrive = resolve)))
    const resume = outcome(h.room.resume())
    await h.advance(GRACE_SECONDS * 1000 + 250)
    expect(rejected(await resume)).toMatchObject({
      code: 'OFFLINE',
      operation: 'resume',
    })
    expect(h.connection()).toBe('offline')
    // The seat came back after all, too late for this call: its rotated token is kept and the seat is not given up.
    const late = h.fake.room()
    late.reconnectionToken = 'ABC234:rotated'
    arrive(late)
    await h.settle()
    expect(late.leaves).toEqual([])
    expect(late.closes).toBe(1)
    expect(late.reconnection.enabled).toBe(false)
    expect(JSON.parse(storage.items.get(SEAT_KEY) as string)).toMatchObject({ token: 'ABC234:rotated' })
  })
})

describe('closing the scope mid-reconnect', () => {
  it('keeps the seat: the rotated token is stored and the socket closed without leaving', async () => {
    const h = await start()
    await h.room.create({ name: 'Ada' })
    let arrive!: (room: FakeRoom) => void
    h.fake.respond('reconnect', new Promise<FakeRoom>((resolve) => (arrive = resolve)))
    h.fake.rooms[0]?.close(1006)
    await h.settle()
    await h.close()
    const late = h.fake.room()
    late.reconnectionToken = 'ABC234:rotated'
    arrive(late)
    await h.settle()
    expect(late.leaves).toEqual([])
    expect(late.closes).toBe(1)
    expect(late.reconnection.enabled).toBe(false)
    expect(JSON.parse(h.items.get(SEAT_KEY) as string)).toMatchObject({ token: 'ABC234:rotated' })
  })
})

describe('resume', () => {
  it('goes straight to reconnecting, never through connecting', async () => {
    const storage = memoryStorage()
    storage.setItem(SEAT_KEY, storedSeat('ABC234', 'ABC234:held'))
    const h = await start({ storage })
    expect(await h.room.resume()).toBe('resumed')
    expect(h.states).toEqual(['offline', 'reconnecting', 'connected'])
  })

  it('gives up its intent when its caller aborts', async () => {
    const storage = memoryStorage()
    storage.setItem(SEAT_KEY, storedSeat('ABC234', 'ABC234:held'))
    const h = await start({ storage })
    h.fake.respond('reconnect', never())
    const abort = new AbortController()
    const resume = outcome(h.room.resume({ signal: abort.signal }))
    await h.settle()
    expect(h.connection()).toBe('reconnecting')
    abort.abort()
    expect(rejected(await resume)).toBe(abort.signal.reason)
    expect(h.connection()).toBe('offline')
  })
})

describe('a handshake that settles at the cap', () => {
  it('is adopted or retired, never both, and the loop ends connected with no ghost room', async () => {
    let h!: Harness
    const handed: FakeRoom[] = []
    // The first reconnect answers on the fake clock exactly when its attempt's 5 s cap runs out; later ones at once.
    const client = (): NetSdkClient => ({
      ...h.fake.client,
      reconnect: (token) => {
        h.fake.calls.push({ method: 'reconnect', args: [token] })
        const room = h.fake.room('ABC234')
        handed.push(room)
        const delay = handed.length === 1 ? 5_000 : 0
        return new Promise<NetSdkRoom>((resolve) =>
          h.clock.setTimeout(() => resolve(room as NetSdkRoom), delay),
        )
      },
    })
    h = await start({ client })
    await h.room.create({ name: 'Ada' })
    h.fake.rooms[0]?.close(1006)
    await h.advance(GRACE_SECONDS * 1000 + 1_000)
    expect(h.ended()).toBeUndefined()
    expect(h.connection()).toBe('connected')
    // One room is the current one; every other room handed out was left or closed, none kept open as a ghost.
    expect(handed.filter((room) => room.listening)).toHaveLength(1)
    for (const room of handed.filter((entry) => !entry.listening))
      expect(room.leaves.length + room.closes).toBeGreaterThan(0)
    // Connected, the loop presents no token again.
    const tries = h.fake.calls.length
    await h.advance(10_000)
    expect(h.fake.calls).toHaveLength(tries)
  })
})

describe('an abandoned attempt whose room arrives while the next is in flight', () => {
  it('is kept (closed without consent), and the attempts converge on its rotated token', async () => {
    const h = await start()
    await h.room.create({ name: 'Ada' })
    const first = h.fake.rooms[0] as FakeRoom
    const presented = first.reconnectionToken
    let arriveA!: (room: FakeRoom) => void
    let failB!: (error: Error) => void
    h.fake.respond('reconnect', new Promise<FakeRoom>((resolve) => (arriveA = resolve)))
    h.fake.respond('reconnect', new Promise<FakeRoom>((_, reject) => (failB = reject)))
    first.close(1006)
    // Attempt A hangs to its 5 s cap; after the 250 ms backoff, attempt B is in flight.
    await h.advance(5_300)
    expect(h.fake.calls.filter((call) => call.method === 'reconnect')).toHaveLength(2)
    expect(h.connection()).toBe('reconnecting')
    // A's room arrives now: no room is current and the stored token is the one A presented, so the seat is kept.
    const lateA = h.fake.room('ABC234')
    lateA.reconnectionToken = 'ABC234:rotated'
    arriveA(lateA)
    await h.settle()
    expect(lateA.leaves).toEqual([])
    expect(lateA.closes).toBe(1)
    expect(lateA.reconnection.enabled).toBe(false)
    expect(JSON.parse(h.items.get(SEAT_KEY) as string)).toMatchObject({ token: 'ABC234:rotated' })
    // B presented the token A used up, and fails; the next attempt presents the rotated token and connects.
    failB(new Error('reconnection token invalid or expired.'))
    await h.advance(1_000)
    const tokens = h.fake.calls.filter((call) => call.method === 'reconnect').map((call) => call.args[0])
    expect(tokens).toEqual([presented, presented, 'ABC234:rotated'])
    expect(h.connection()).toBe('connected')
    expect(h.ended()).toBeUndefined()
  })
})
