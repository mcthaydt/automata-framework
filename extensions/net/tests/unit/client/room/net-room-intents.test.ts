import { afterEach, describe, expect, it } from 'vitest'
import type { NetError } from '#src/features/client/room/net-error.ts'
import type { FakeRoom } from '#src/testing/fake-colyseus.ts'
import {
  type Harness,
  memoryStorage,
  outcome,
  rejected,
  SEAT_KEY,
  startHarness,
  storedSeat,
} from '#src/testing/net-room-harness.ts'

// One intent owns its asynchronous room work: a handshake that settles after the player moved on is left, and changes nothing.

let harness: Harness | undefined
afterEach(async () => {
  await harness?.close()
  harness = undefined
})
const start = async (...args: Parameters<typeof startHarness>) => {
  harness = await startHarness(...args)
  return harness
}

function deferred() {
  let resolve!: (room: FakeRoom) => void
  let reject!: (error: Error) => void
  const promise = new Promise<FakeRoom>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

const KINDS = ['create', 'join', 'quick', 'resume'] as const
const METHOD = { create: 'create', join: 'joinById', quick: 'joinOrCreate', resume: 'reconnect' } as const

describe('one intent owns its handshakes', () => {
  for (const kind of KINDS) {
    for (const failure of [false, true]) {
      it(`leaves an old ${kind} that ${failure ? 'fails' : 'succeeds'} after a later create, changing nothing`, async () => {
        const storage = memoryStorage()
        if (kind === 'resume') storage.setItem(SEAT_KEY, storedSeat('XYZ789', 'XYZ789:t'))
        const h = await start({ storage })
        const handshake = deferred()
        h.fake.respond(METHOD[kind], handshake.promise)
        const call: Promise<unknown> =
          kind === 'create'
            ? h.room.create({ name: 'Old' })
            : kind === 'join'
              ? h.room.join('XYZ789', { name: 'Old' })
              : kind === 'quick'
                ? h.room.quickMatch({ name: 'Old' })
                : h.room.resume()
        const old = outcome(call)
        await h.settle()
        const next = h.fake.room('NEW234')
        h.fake.respond('create', next)
        await h.room.create({ name: 'New' })
        const kept = storage.items.get(SEAT_KEY)
        const obsolete = h.fake.room('XYZ789')
        if (failure) handshake.reject(new Error('ROOM_FULL: old handshake failed'))
        else handshake.resolve(obsolete)
        const result = await old
        expect(result.ok).toBe(true)
        if (kind === 'resume') expect(result.ok && result.value).toBe('none')
        if (!failure) expect(obsolete.leaves).toEqual([true])
        expect(h.info()?.code).toBe('NEW234')
        expect(h.connection()).toBe('connected')
        expect(h.ended()).toBeUndefined()
        expect(storage.items.get(SEAT_KEY)).toBe(kept)
        // The current room still drives the info: its listeners survived.
        next.message({ t: 'seated', seat: 3 })
        expect(h.info()?.you).toBe(3)
        obsolete.message({ t: 'seated', seat: 1 })
        expect(h.info()?.you).toBe(3)
      })
    }
  }

  it('does not adopt an old reconnect after a leave, and leaves it', async () => {
    // Leaving closes the scope: an old reconnect is not adopted. The scope closing alone is
    // net-room-review.test.ts's: there the seat is kept, not left.
    const h = await start()
    await h.room.create({ name: 'Ada' })
    const handshake = deferred()
    h.fake.respond('reconnect', handshake.promise)
    h.fake.rooms[0]?.close(1006)
    await h.settle()
    await h.room.leave()
    const obsolete = h.fake.room('ABC234')
    handshake.resolve(obsolete)
    await h.settle()
    expect(obsolete.leaves).toEqual([true])
    expect(h.connection()).toBe('offline')
    expect(h.info()).toBeUndefined()
  })

  it.each(['create', 'resume'] as const)('a caller that aborts its %s gives up the intent', async (kind) => {
    const storage = memoryStorage()
    storage.setItem(SEAT_KEY, storedSeat('XYZ789', 'XYZ789:t'))
    const h = await start({ storage })
    const handshake = deferred()
    h.fake.respond(METHOD[kind], handshake.promise)
    const abort = new AbortController()
    const call = outcome<unknown>(
      kind === 'create'
        ? h.room.create({ name: 'Ada', signal: abort.signal })
        : h.room.resume({ signal: abort.signal }),
    )
    await h.settle()
    abort.abort()
    expect(rejected(await call)).toBe(abort.signal.reason)
    expect(h.connection()).toBe('offline')
    const late = h.fake.room()
    handshake.resolve(late)
    await h.settle()
    if (kind === 'create') {
      expect(late.leaves).toEqual([true])
    } else {
      // A resume reclaims the seat this client still holds, so a room that arrives late is kept for the next load:
      // closed without consent, so the server holds the seat.
      expect(late.leaves).toEqual([])
      expect(late.closes).toBe(1)
    }
    expect(h.info()).toBeUndefined()
  })

  it('a call whose signal has already aborted never starts', async () => {
    const h = await start()
    const abort = new AbortController()
    abort.abort()
    expect(rejected(await outcome(h.room.create({ name: 'Ada', signal: abort.signal })))).toBe(
      abort.signal.reason,
    )
    expect(h.fake.calls).toEqual([])
    expect(h.states).toEqual(['offline'])
  })

  it('detaches and forgets at once while the SDK leave is still pending', async () => {
    const h = await start()
    await h.room.create({ name: 'Old' })
    const old = h.fake.rooms[0] as FakeRoom
    let finish!: (code: number) => void
    old.leave = () => new Promise<number>((resolve) => (finish = resolve))
    const leaving = outcome(h.room.leave())
    await h.settle()
    expect(h.connection()).toBe('offline')
    expect(h.info()).toBeUndefined()
    const next = h.fake.room('NEW234')
    h.fake.respond('create', next)
    await h.room.create({ name: 'New' })
    const kept = h.items.get(SEAT_KEY)
    finish(4000)
    await leaving
    expect(h.connection()).toBe('connected')
    expect(h.info()?.code).toBe('NEW234')
    expect(h.items.get(SEAT_KEY)).toBe(kept)
  })

  it('leaves the previous room when the player joins another', async () => {
    const h = await start()
    await h.room.create({ name: 'Ada' })
    const first = h.fake.rooms[0]
    await h.room.join('XYZ789', { name: 'Ada' })
    expect(first?.leaves).toEqual([true])
    expect(first?.listening).toBe(false)
    expect(h.info()?.code).toBe('XYZ789')
  })

  it('closes the socket on dispose without giving up the reload seat', async () => {
    // Disposing closes the transport, keeps the reload seat and rejects pending commands.
    const h = await start()
    await h.room.create({ name: 'Ada' })
    const room = h.fake.rooms[0] as FakeRoom
    const kept = h.items.get(SEAT_KEY)
    const outcomes: string[] = []
    void h.room.setReady(true).then(
      () => outcomes.push('ok'),
      (error: NetError) => outcomes.push(error.code),
    )
    await h.settle()
    await h.close()
    expect(outcomes).toEqual(['OFFLINE'])
    expect(kept).toBeDefined()
    expect(h.items.get(SEAT_KEY)).toBe(kept)
    expect(room.closes).toBe(1)
    expect(room.leaves).toEqual([])
    expect(room.listening).toBe(false)
  })
})
