import { Exit, Fiber } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import {
  GRACE_SECONDS,
  type Harness,
  memoryStorage,
  SEAT_KEY,
  startHarness,
  storedSeat,
} from '../test-support/net-room-harness'
import type { FakeRoom } from '../testing/fake-colyseus'
import { type SeatStorage, seatTokenKey } from './seat-token'

// The cases the PR #13 review found (M7.5a): storage that fails, a seat stored for another server, handshakes that
// never settle, a scope closed mid-reconnect, and an interrupted resume. TestClock throughout.

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
const failureCode = (exit: Exit.Exit<unknown, unknown>) =>
  Exit.isFailure(exit) && exit.cause._tag === 'Fail' ? exit.cause.error : undefined

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
    ['is missing (a worker, a headless client)', undefined],
  ])('reconnects into its seat when storage %s', async (_, storage) => {
    const h = await start({ storage })
    await h.run(h.room.create({ name: 'Ada' }))
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
    expect(await h.run(h.room.resume)).toBe('none')
    expect(h.fake.calls).toEqual([])
    expect(storage.items.get(otherKey)).toBe(storedSeat('ABC234', 'ABC234:theirs', 'wss://other-game.test'))
  })
})

describe('handshakes that never settle', () => {
  it('give the seat up when the grace passes, even mid-attempt', async () => {
    const h = await start()
    await h.run(h.room.create({ name: 'Ada' }))
    h.fake.respondAlways('reconnect', never())
    h.fake.rooms[0]?.close(1006)
    await h.advance(GRACE_SECONDS * 1000 + 250)
    expect(h.ended()).toEqual({ reason: 'seat-lost' })
    expect(h.connection()).toBe('offline')
  })

  it('a room that arrives after the grace is left', async () => {
    const h = await start()
    await h.run(h.room.create({ name: 'Ada' }))
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
    const resume = h.start(h.room.resume)
    await h.advance(GRACE_SECONDS * 1000 + 250)
    expect(failureCode(await h.run(Fiber.await(resume)))).toMatchObject({
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
    expect(JSON.parse(storage.items.get(SEAT_KEY) as string)).toMatchObject({ token: 'ABC234:rotated' })
  })
})

describe('closing the scope mid-reconnect', () => {
  it('keeps the seat: the rotated token is stored and the socket closed without leaving', async () => {
    const h = await start()
    await h.run(h.room.create({ name: 'Ada' }))
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
    expect(JSON.parse(h.items.get(SEAT_KEY) as string)).toMatchObject({ token: 'ABC234:rotated' })
  })
})

describe('resume', () => {
  it('goes straight to reconnecting, never through connecting', async () => {
    const storage = memoryStorage()
    storage.setItem(SEAT_KEY, storedSeat('ABC234', 'ABC234:held'))
    const h = await start({ storage })
    expect(await h.run(h.room.resume)).toBe('resumed')
    expect(h.states).toEqual(['offline', 'reconnecting', 'connected'])
  })

  it('gives up its intent when its caller is interrupted', async () => {
    const storage = memoryStorage()
    storage.setItem(SEAT_KEY, storedSeat('ABC234', 'ABC234:held'))
    const h = await start({ storage })
    h.fake.respond('reconnect', never())
    const resume = h.start(h.room.resume)
    await h.settle()
    expect(h.connection()).toBe('reconnecting')
    await h.run(Fiber.interrupt(resume))
    expect(h.connection()).toBe('offline')
  })
})
