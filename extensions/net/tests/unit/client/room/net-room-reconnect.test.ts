import { afterEach, describe, expect, it } from 'vitest'
import { NET_CHANNEL } from '#src/shared/wire/room.ts'
import {
  failure,
  GRACE_SECONDS,
  type Harness,
  memoryStorage,
  outcome,
  rejected,
  SEAT_KEY,
  startHarness,
  storedSeat,
} from '#src/testing/net-room-harness.ts'

// NetRoom across a drop and a reload. Time is the fake clock's: a grace of 30 s passes in a test without a 30 s wait.

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
const stored = (h: Harness) => {
  const raw = h.items.get(SEAT_KEY)
  if (raw === undefined) return undefined
  const { code, token } = JSON.parse(raw)
  return { code, token }
}

describe('the reconnection token', () => {
  it('is stored in session storage with the room code', async () => {
    const h = await start()
    await h.room.create({ name: 'Ada' })
    const room = h.fake.rooms[0]
    expect(stored(h)).toEqual({ code: 'ABC234', token: room?.reconnectionToken })
  })

  it('is forgotten when the player leaves, and leaving never reconnects', async () => {
    const h = await start()
    await h.room.create({ name: 'Ada' })
    const room = h.fake.rooms[0]
    await h.room.leave()
    await h.advance(GRACE_SECONDS * 1000 + 1000)
    expect(room?.leaves).toEqual([true])
    expect(room?.listening).toBe(false)
    expect(stored(h)).toBeUndefined()
    expect(h.fake.calls.map((call) => call.method)).toEqual(['create'])
    expect(h.states).not.toContain('reconnecting')
    expect(h.connection()).toBe('offline')
    expect(h.info()).toBeUndefined()
    expect(h.ended()).toBeUndefined()
  })
})

describe('a dropped connection', () => {
  it('reconnects into its seat with the stored token, keeping the room info meanwhile', async () => {
    // reconnect.test "retains the last snapshot so the world stays on screen" and "hides the indicator again once
    // the seat is reclaimed".
    const h = await start()
    await h.room.create({ name: 'Ada' })
    const first = h.fake.rooms[0]
    first?.message({ t: 'seated', seat: 0 })
    const token = first?.reconnectionToken
    first?.close(1006)
    expect(h.connection()).toBe('reconnecting')
    expect(h.info()).toMatchObject({ code: 'ABC234', you: 0 })
    await h.settle()
    expect(h.fake.calls.at(-1)).toEqual({ method: 'reconnect', args: [token] })
    expect(h.connection()).toBe('connected')
    expect(h.info()).toMatchObject({ code: 'ABC234', you: 0 })
    expect(h.states.slice(-2)).toEqual(['reconnecting', 'connected'])
  })

  it('keeps trying while the seat is held, and gives the seat up when the grace has passed', async () => {
    const h = await start()
    await h.room.create({ name: 'Ada' })
    h.fake.respondAlways('reconnect', new Error('reconnection token invalid or expired.'))
    h.fake.rooms[0]?.close(1006)
    await h.advance(5_000)
    expect(h.connection()).toBe('reconnecting')
    // 0, 250, 750 (250 + 500), 1750, 3750: five tries in the first five seconds, at the backoff's pace.
    expect(h.fake.calls.filter((call) => call.method === 'reconnect')).toHaveLength(5)
    await h.advance(GRACE_SECONDS * 1000)
    expect(h.connection()).toBe('offline')
    expect(h.ended()).toEqual({ reason: 'seat-lost' })
    expect(h.info()).toBeUndefined()
    expect(stored(h)).toBeUndefined()
    const tries = h.fake.calls.length
    await h.advance(10_000)
    expect(h.fake.calls).toHaveLength(tries)
  })

  it('persists a rotated token before the reconnect is announced', async () => {
    const h = await start()
    await h.room.create({ name: 'Ada' })
    const returned = h.fake.room('ABC234')
    returned.reconnectionToken = 'ABC234:rotated'
    h.fake.respond('reconnect', returned)
    h.fake.rooms[0]?.close(1006)
    await h.settle()
    expect(h.connection()).toBe('connected')
    expect(stored(h)).toEqual({ code: 'ABC234', token: 'ABC234:rotated' })
    returned.close(1006)
    await h.settle()
    expect(h.fake.calls.at(-1)).toEqual({ method: 'reconnect', args: ['ABC234:rotated'] })
  })

  it.each([
    [4000, 'closed'],
    [1000, 'closed'],
    [4001, 'server-updating'],
    [4002, 'failed'],
  ] as const)('treats close %i as the room ending (%s), not a drop', async (code, reason) => {
    // A consented close and a server shutdown both end the room; neither is a drop.
    const h = await start()
    await h.room.create({ name: 'Ada' })
    h.fake.rooms[0]?.close(code)
    await h.advance(1_000)
    expect(h.fake.calls.map((call) => call.method)).toEqual(['create'])
    expect(h.connection()).toBe('offline')
    expect(h.ended()).toEqual({ reason })
    expect(stored(h)).toBeUndefined()
  })

  it('fails a request sent while reconnecting as offline', async () => {
    const h = await start()
    await h.room.create({ name: 'Ada' })
    h.fake.respondAlways('reconnect', new Error('no'))
    h.fake.rooms[0]?.close(1006)
    expect(await failure(h.room.setReady(true))).toMatchObject({ code: 'OFFLINE' })
  })

  it('fails a request on a room a reconnect replaced', async () => {
    const h = await start()
    await h.room.create({ name: 'Ada' })
    const fiber = outcome(h.room.setReady(true))
    await h.settle()
    h.fake.rooms[0]?.close(1006)
    await h.settle()
    expect(h.connection()).toBe('connected')
    expect(rejected(await fiber)).toMatchObject({ code: 'OFFLINE' })
  })

  it('cancels a backoff when the player starts something else, past its deadline', async () => {
    const h = await start()
    await h.room.create({ name: 'Ada' })
    h.fake.respondAlways('reconnect', new Error('offline'))
    h.fake.rooms[0]?.close(1006)
    await h.advance(1)
    const tries = h.fake.calls.length
    const next = h.fake.room('NEW234')
    h.fake.respond('create', next)
    await h.room.create({ name: 'Bo' })
    await h.advance(GRACE_SECONDS * 1000 + 3_000)
    expect(h.fake.calls.filter((call) => call.method === 'reconnect')).toHaveLength(tries - 1)
    expect(h.info()?.code).toBe('NEW234')
    expect(h.connection()).toBe('connected')
    expect(h.ended()).toBeUndefined()
  })
})

describe('a reload mid-room', () => {
  it('resumes a stored seat once, and is seated again', async () => {
    const storage = memoryStorage()
    const before = await start({ storage })
    await before.room.create({ name: 'Ada' })
    const token = before.fake.rooms[0]?.reconnectionToken
    await before.close()
    // The page reloads: a new NetRoom on the same session storage.
    const after = await start({ storage })
    expect(await after.room.resume()).toBe('resumed')
    expect(after.fake.calls).toEqual([{ method: 'reconnect', args: [token] }])
    expect(after.connection()).toBe('connected')
    after.fake.rooms[0]?.message({ t: 'seated', seat: 0 })
    expect(after.info()).toMatchObject({ code: 'ABC234', you: 0 })
    // Once: a second resume does nothing.
    expect(await after.room.resume()).toBe('none')
    expect(after.fake.calls).toHaveLength(1)
  })

  it('reports nothing to resume when no seat is stored', async () => {
    const h = await start()
    expect(await h.room.resume()).toBe('none')
    expect(h.fake.calls).toEqual([])
    expect(h.connection()).toBe('offline')
  })

  it('reports an expired seat, forgets it, and never retries it', async () => {
    // An expired token reports expired and is forgotten, not retried.
    const storage = memoryStorage()
    storage.setItem(SEAT_KEY, storedSeat('ABC234', 'ABC234:old'))
    const h = await start({ storage })
    h.fake.respondAlways('reconnect', new Error('reconnection token invalid or expired.'))
    expect(await h.room.resume()).toBe('expired')
    await h.advance(GRACE_SECONDS * 1000)
    expect(h.fake.calls).toHaveLength(1)
    expect(stored(h)).toBeUndefined()
    expect(h.connection()).toBe('offline')
  })

  it('fails offline, keeping the token, when the server cannot be reached', async () => {
    const storage = memoryStorage()
    storage.setItem(SEAT_KEY, storedSeat('ABC234', 'ABC234:old'))
    const h = await start({ storage })
    h.fake.respond('reconnect', new TypeError('fetch failed'))
    expect(await failure(h.room.resume())).toMatchObject({ code: 'OFFLINE', operation: 'resume' })
    expect(stored(h)).toEqual({ code: 'ABC234', token: 'ABC234:old' })
    expect(h.connection()).toBe('offline')
  })
})

describe('probing', () => {
  const probes = (h: Harness) =>
    h.fake.rooms
      .flatMap((room) => room.sent)
      .filter((entry) => entry.type === NET_CHANNEL)
      .map((entry) => JSON.parse(entry.payload as string))
      .filter((message) => message.t === 'ping')

  it('probes once a second while connected, so play starts knowing its round trip, and stops on leave', async () => {
    const h = await start()
    await h.advance(3_000)
    expect(probes(h)).toEqual([])
    await h.room.create({ name: 'Ada' })
    await h.advance(3_100)
    expect(probes(h).length).toBeGreaterThanOrEqual(2)
    expect(probes(h).every((probe) => probe.tick === -1)).toBe(true)
    await h.room.leave()
    const after = probes(h).length
    await h.advance(5_000)
    expect(probes(h)).toHaveLength(after)
  })

  it('skips the background probe while play is probing', async () => {
    const h = await start()
    await h.room.create({ name: 'Ada' })
    for (let second = 0; second < 3; second += 1) {
      h.room.port.ping(10 + second)
      await h.advance(900)
    }
    expect(probes(h).map((probe) => probe.tick)).toEqual([10, 11, 12])
  })
})
