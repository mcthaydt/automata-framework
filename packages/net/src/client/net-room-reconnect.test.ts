import { Exit } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { GRACE_SECONDS, type Harness, memoryStorage, startHarness } from '../test-support/net-room-harness'
import { NET_CHANNEL } from '../wire/room'
import { SEAT_TOKEN_KEY } from './seat-token'

// NetRoom across a drop and a reload (M7 spec §4.2 "Reconnection", §5 "Drop and reconnect", "Reload mid-room", §6
// "Connection lost", §13 N-c; FloorFifty `colyseus-network.test.ts` and `reconnect.test.ts` at 677d456, the generic
// cases, named where ported). Time is TestClock's: a grace of 30 s passes in a test without a 30 s wait.

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
  const raw = h.storage.items.get(SEAT_TOKEN_KEY)
  return raw === undefined ? undefined : JSON.parse(raw)
}
const failureCode = (exit: Exit.Exit<unknown, unknown>) =>
  Exit.isFailure(exit) && exit.cause._tag === 'Fail' ? exit.cause.error : undefined

describe('the reconnection token', () => {
  it('is stored in session storage with the room code', async () => {
    // FloorFifty "stores the reconnection token in session storage and never in the url".
    const h = await start()
    await h.run(h.room.create({ name: 'Ada' }))
    const room = h.fake.rooms[0]
    expect(stored(h)).toEqual({ code: 'ABC234', token: room?.reconnectionToken })
  })

  it('is forgotten when the player leaves, and leaving never reconnects', async () => {
    // FloorFifty "does not try to reconnect to a room it chose to leave" and "detaches every listener when it leaves".
    const h = await start()
    await h.run(h.room.create({ name: 'Ada' }))
    const room = h.fake.rooms[0]
    await h.run(h.room.leave)
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
    await h.run(h.room.create({ name: 'Ada' }))
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
    // FloorFifty "keeps trying while the seat is held and gives up when the window closes".
    const h = await start()
    await h.run(h.room.create({ name: 'Ada' }))
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
    // FloorFifty "persists a rotated token before a reconnect is announced seated".
    const h = await start()
    await h.run(h.room.create({ name: 'Ada' }))
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
    // FloorFifty "treats a consented close from the server as the room ending, not a drop" and "treats a server
    // shutdown as the room ending, not a drop"; reconnect.test "leaves Gameplay with a reason when the room closes".
    const h = await start()
    await h.run(h.room.create({ name: 'Ada' }))
    h.fake.rooms[0]?.close(code)
    await h.advance(1_000)
    expect(h.fake.calls.map((call) => call.method)).toEqual(['create'])
    expect(h.connection()).toBe('offline')
    expect(h.ended()).toEqual({ reason })
    expect(stored(h)).toBeUndefined()
  })

  it('fails a request sent while reconnecting as offline', async () => {
    const h = await start()
    await h.run(h.room.create({ name: 'Ada' }))
    h.fake.respondAlways('reconnect', new Error('no'))
    h.fake.rooms[0]?.close(1006)
    expect(failureCode(await h.exit(h.room.setReady(true)))).toMatchObject({ code: 'OFFLINE' })
  })

  it('fails a request on a room a reconnect replaced', async () => {
    // FloorFifty "rejects a command sent to a room that a reconnect replaced".
    const h = await start()
    await h.run(h.room.create({ name: 'Ada' }))
    const fiber = h.start(h.room.setReady(true))
    await h.settle()
    h.fake.rooms[0]?.close(1006)
    await h.settle()
    expect(h.connection()).toBe('connected')
    expect(failureCode(await h.run(fiber.await))).toMatchObject({ code: 'OFFLINE' })
  })

  it('cancels a backoff when the player starts something else, past its deadline', async () => {
    // FloorFifty "cancels a reconnect backoff before a replacement intent and its deadline".
    const h = await start()
    await h.run(h.room.create({ name: 'Ada' }))
    h.fake.respondAlways('reconnect', new Error('offline'))
    h.fake.rooms[0]?.close(1006)
    await h.advance(1)
    const tries = h.fake.calls.length
    const next = h.fake.room('NEW234')
    h.fake.respond('create', next)
    await h.run(h.room.create({ name: 'Bo' }))
    await h.advance(GRACE_SECONDS * 1000 + 3_000)
    expect(h.fake.calls.filter((call) => call.method === 'reconnect')).toHaveLength(tries - 1)
    expect(h.info()?.code).toBe('NEW234')
    expect(h.connection()).toBe('connected')
    expect(h.ended()).toBeUndefined()
  })
})

describe('a reload mid-room (N-c)', () => {
  it('resumes a stored seat once, and is seated again', async () => {
    // FloorFifty "resumes a stored seat once, at boot".
    const storage = memoryStorage()
    const before = await start({ storage })
    await before.run(before.room.create({ name: 'Ada' }))
    const token = before.fake.rooms[0]?.reconnectionToken
    await before.close()
    // The page reloads: a new NetRoom on the same session storage.
    const after = await start({ storage })
    expect(await after.run(after.room.resume)).toBe('resumed')
    expect(after.fake.calls).toEqual([{ method: 'reconnect', args: [token] }])
    expect(after.connection()).toBe('connected')
    after.fake.rooms[0]?.message({ t: 'seated', seat: 0 })
    expect(after.info()).toMatchObject({ code: 'ABC234', you: 0 })
    // Once: a second resume does nothing.
    expect(await after.run(after.room.resume)).toBe('none')
    expect(after.fake.calls).toHaveLength(1)
  })

  it('reports nothing to resume when no seat is stored', async () => {
    // FloorFifty "reports nothing to resume when no seat is stored".
    const h = await start()
    expect(await h.run(h.room.resume)).toBe('none')
    expect(h.fake.calls).toEqual([])
    expect(h.connection()).toBe('offline')
  })

  it('reports an expired seat, forgets it, and never retries it', async () => {
    // FloorFifty "forgets an expired seat instead of retrying it"; N-c "an expired token reports expired and is
    // forgotten".
    const storage = memoryStorage()
    storage.setItem(SEAT_TOKEN_KEY, JSON.stringify({ code: 'ABC234', token: 'ABC234:old' }))
    const h = await start({ storage })
    h.fake.respondAlways('reconnect', new Error('reconnection token invalid or expired.'))
    expect(await h.run(h.room.resume)).toBe('expired')
    await h.advance(GRACE_SECONDS * 1000)
    expect(h.fake.calls).toHaveLength(1)
    expect(stored(h)).toBeUndefined()
    expect(h.connection()).toBe('offline')
  })

  it('fails offline, keeping the token, when the server cannot be reached', async () => {
    const storage = memoryStorage()
    storage.setItem(SEAT_TOKEN_KEY, JSON.stringify({ code: 'ABC234', token: 'ABC234:old' }))
    const h = await start({ storage })
    h.fake.respond('reconnect', new TypeError('fetch failed'))
    expect(failureCode(await h.exit(h.room.resume))).toMatchObject({ code: 'OFFLINE', operation: 'resume' })
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
    // FloorFifty "keeps probing once a second while seated, so a race starts knowing its round trip".
    const h = await start()
    await h.advance(3_000)
    expect(probes(h)).toEqual([])
    await h.run(h.room.create({ name: 'Ada' }))
    await h.advance(3_100)
    expect(probes(h).length).toBeGreaterThanOrEqual(2)
    expect(probes(h).every((probe) => probe.tick === -1)).toBe(true)
    await h.run(h.room.leave)
    const after = probes(h).length
    await h.advance(5_000)
    expect(probes(h)).toHaveLength(after)
  })

  it('skips the background probe while play is probing', async () => {
    const h = await start()
    await h.run(h.room.create({ name: 'Ada' }))
    for (let second = 0; second < 3; second += 1) {
      h.room.port.ping(10 + second)
      await h.advance(900)
    }
    expect(probes(h).map((probe) => probe.tick)).toEqual([10, 11, 12])
  })
})
