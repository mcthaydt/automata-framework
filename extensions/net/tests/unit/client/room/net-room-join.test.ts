import { afterEach, describe, expect, it } from 'vitest'
import { PROTOCOL_VERSION } from '#src/shared/wire/limits.ts'
import { NET_CHANNEL, ROOM_NAME } from '#src/shared/wire/room.ts'
import {
  failure,
  HASH_A,
  HASH_B,
  type Harness,
  outcome,
  rejected,
  startHarness,
} from '#src/testing/net-room-harness.ts'

// NetRoom: create, join, quick match and the room's requests.

const JOIN = { protocol: PROTOCOL_VERSION, schemaHash: HASH_A, contentHash: HASH_B, name: 'Ada' }

let harness: Harness | undefined
afterEach(async () => {
  await harness?.close()
  harness = undefined
})

const start = async (...args: Parameters<typeof startHarness>) => {
  harness = await startHarness(...args)
  return harness
}

describe('joining a room', () => {
  it('creates a room with the join check and is connected', async () => {
    const h = await start()
    expect(h.connection()).toBe('offline')
    await h.room.create({ name: 'Ada' })
    expect(h.fake.calls).toEqual([{ method: 'create', args: [ROOM_NAME, JOIN] }])
    expect(h.connection()).toBe('connected')
    expect(h.states).toEqual(['offline', 'connecting', 'connected'])
  })

  it('joins by code', async () => {
    const h = await start()
    await h.room.join('XYZ789', { name: 'Ada' })
    expect(h.fake.calls).toEqual([{ method: 'joinById', args: ['XYZ789', JOIN] }])
    expect(h.info()?.code).toBe('XYZ789')
  })

  it('finds a room with joinOrCreate', async () => {
    const h = await start()
    await h.room.quickMatch({ name: 'Ada' })
    expect(h.fake.calls).toEqual([{ method: 'joinOrCreate', args: [ROOM_NAME, JOIN] }])
    expect(h.connection()).toBe('connected')
  })

  it("puts the host's session token in the join options when there is one", async () => {
    const h = await start({ session: () => 'host-session-token' })
    await h.room.create({ name: 'Ada' })
    expect(h.fake.calls[0]?.args[1]).toEqual({ ...JOIN, session: 'host-session-token' })
  })

  it('refuses a name the wire refuses without touching the network', async () => {
    const h = await start()
    expect(await failure(h.room.create({ name: 'Ada<script>' }))).toMatchObject({
      code: 'REFUSED',
      operation: 'create',
    })
    expect(h.fake.calls).toEqual([])
  })

  it.each(['ROOM_FULL', 'ROOM_NOT_FOUND', 'REFUSED'] as const)(
    'tries once more when the offered room is gone or taken (%s)',
    async (code) => {
      const h = await start()
      h.fake.respond('joinOrCreate', new Error(`${code}: gone`))
      await h.room.quickMatch({ name: 'Ada' })
      expect(h.fake.calls.map((call) => call.method)).toEqual(['joinOrCreate', 'joinOrCreate'])
      expect(h.connection()).toBe('connected')
    },
  )

  it('says so when the second try is refused too, and tries no third time', async () => {
    const h = await start()
    h.fake.respondAlways('joinOrCreate', new Error('room "ABC234" is locked'))
    expect(await failure(h.room.quickMatch({ name: 'Ada' }))).toMatchObject({
      code: 'ROOM_FULL',
      operation: 'quickMatch',
    })
    expect(h.fake.calls).toHaveLength(2)
    expect(h.connection()).toBe('offline')
  })

  it('does not retry a refusal that is not about the room', async () => {
    const h = await start()
    h.fake.respond('joinOrCreate', new Error('VERSION_MISMATCH: this game is out of date: reload to play'))
    expect(await failure(h.room.quickMatch({ name: 'Ada' }))).toMatchObject({ code: 'VERSION_MISMATCH' })
    expect(h.fake.calls).toHaveLength(1)
  })

  it.each([
    ['SERVER_UPDATING: the server is updating', 'SERVER_UPDATING'],
    ['SERVER_BUSY: the server is full', 'SERVER_BUSY'],
    ['RATE_LIMITED: too many requests, try again shortly', 'RATE_LIMITED'],
    ['VERSION_MISMATCH: this game is out of date: reload to play', 'VERSION_MISMATCH'],
    ['UNVERIFIED: the session could not be verified', 'UNVERIFIED'],
    ['room "ABC234" is locked', 'ROOM_FULL'],
    ['room "ABC234" not found', 'ROOM_NOT_FOUND'],
  ])('reads the refusal %j as %s, and is offline again', async (message, code) => {
    const h = await start()
    h.fake.respond('create', new Error(message))
    expect(await failure(h.room.create({ name: 'Ada' }))).toMatchObject({ code, operation: 'create' })
    expect(h.connection()).toBe('offline')
    expect(h.info()).toBeUndefined()
  })

  it('reads a server it cannot reach as offline', async () => {
    const h = await start()
    h.fake.respond('joinById', new TypeError('fetch failed'))
    expect(await failure(h.room.join('ABC234', { name: 'Ada' }))).toMatchObject({
      code: 'OFFLINE',
      operation: 'join',
    })
  })
})

describe('the room info', () => {
  it('mirrors the room state, and your seat once the room says it', async () => {
    const h = await start()
    await h.room.create({ name: 'Ada' })
    expect(h.info()).toMatchObject({ code: 'ABC234', phase: 'lobby', you: undefined, hostSeat: 0 })
    const room = h.fake.rooms[0]
    room?.message({ t: 'seated', seat: 0 })
    expect(h.info()?.you).toBe(0)
    room?.patch(h.fake.state('ABC234', { phase: 'countdown' }))
    expect(h.info()).toMatchObject({ phase: 'countdown', you: 0 })
  })

  it('keeps the info it showed while a patch does not parse', async () => {
    const h = await start()
    await h.room.create({ name: 'Ada' })
    h.fake.rooms[0]?.patch({})
    expect(h.info()?.code).toBe('ABC234')
  })
})

describe('room requests', () => {
  const requested = (h: Harness) =>
    (h.fake.rooms.at(-1)?.sent ?? [])
      .filter((entry) => entry.type === NET_CHANNEL)
      .map((entry) => JSON.parse(entry.payload as string))

  it('sends ready as a correlated request, resolved by its answer', async () => {
    const h = await start()
    await h.room.create({ name: 'Ada' })
    const fiber = outcome(h.room.setReady(true))
    await h.settle()
    const [message] = requested(h)
    expect(message).toMatchObject({ t: 'ready', ready: true })
    expect(message.req).toMatch(/^load0001-r\d+$/)
    h.fake.rooms[0]?.message({ t: 'answer', req: message.req })
    expect((await fiber).ok).toBe(true)
  })

  it('fails a refused request with the room’s code, and the room carries on', async () => {
    // reconnect.test "does not leave the race for a failure it can continue through".
    const h = await start()
    await h.room.create({ name: 'Ada' })
    const fiber = outcome(h.room.addBot())
    await h.settle()
    h.fake.rooms[0]?.message({ t: 'answer', req: requested(h)[0].req, error: 'RATE_LIMITED' })
    expect(rejected(await fiber)).toMatchObject({ code: 'RATE_LIMITED', operation: 'addBot' })
    expect(h.connection()).toBe('connected')
    expect(h.ended()).toBeUndefined()
  })

  it('removes a bot by its seat', async () => {
    const h = await start()
    await h.room.create({ name: 'Ada' })
    outcome(h.room.removeBot(2))
    await h.settle()
    expect(requested(h)[0]).toMatchObject({ t: 'bot.remove', seat: 2 })
  })

  it('fails a request with no room as offline', async () => {
    const h = await start()
    expect(await failure(h.room.setReady(true))).toMatchObject({
      code: 'OFFLINE',
      operation: 'setReady',
    })
  })

  it('fails a request whose answer was lost when the room is left', async () => {
    const h = await start()
    await h.room.create({ name: 'Ada' })
    const fiber = outcome(h.room.setReady(true))
    await h.settle()
    await h.room.leave()
    expect(rejected(await fiber)).toMatchObject({ code: 'OFFLINE' })
  })
})
