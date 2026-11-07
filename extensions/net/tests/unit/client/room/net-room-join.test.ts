import { Exit } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import { PROTOCOL_VERSION } from '#src/shared/wire/limits.ts'
import { NET_CHANNEL, ROOM_NAME } from '#src/shared/wire/room.ts'
import { HASH_A, HASH_B, type Harness, startHarness } from '#src/testing/net-room-harness.ts'

// NetRoom: create, join, quick match and the room's requests (M7 spec §4.2, §5 "Create or join", §6; FloorFifty
// `tests/client/managers/network/colyseus-network.test.ts` at 677d456, the generic cases, named where ported).

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

const failureCode = (exit: Exit.Exit<unknown, { code: string; operation: string }>) =>
  Exit.isFailure(exit) && exit.cause._tag === 'Fail' ? exit.cause.error : undefined

describe('joining a room', () => {
  it('creates a room with the join check and is connected', async () => {
    // FloorFifty "creates a room with the protocol version and remembers the seat".
    const h = await start()
    expect(h.connection()).toBe('offline')
    await h.run(h.room.create({ name: 'Ada' }))
    expect(h.fake.calls).toEqual([{ method: 'create', args: [ROOM_NAME, JOIN] }])
    expect(h.connection()).toBe('connected')
    expect(h.states).toEqual(['offline', 'connecting', 'connected'])
  })

  it('joins by code', async () => {
    const h = await start()
    await h.run(h.room.join('XYZ789', { name: 'Ada' }))
    expect(h.fake.calls).toEqual([{ method: 'joinById', args: ['XYZ789', JOIN] }])
    expect(h.info()?.code).toBe('XYZ789')
  })

  it('finds a room with joinOrCreate', async () => {
    // FloorFifty "finds a race with joinOrCreate … and remembers the seat".
    const h = await start()
    await h.run(h.room.quickMatch({ name: 'Ada' }))
    expect(h.fake.calls).toEqual([{ method: 'joinOrCreate', args: [ROOM_NAME, JOIN] }])
    expect(h.connection()).toBe('connected')
  })

  it("puts the host's session token in the join options when there is one", async () => {
    const h = await start({ session: () => 'host-session-token' })
    await h.run(h.room.create({ name: 'Ada' }))
    expect(h.fake.calls[0]?.args[1]).toEqual({ ...JOIN, session: 'host-session-token' })
  })

  it('refuses a name the wire refuses without touching the network', async () => {
    const h = await start()
    const exit = await h.exit(h.room.create({ name: 'Ada<script>' }))
    expect(failureCode(exit)).toMatchObject({ code: 'REFUSED', operation: 'create' })
    expect(h.fake.calls).toEqual([])
  })

  it.each(['ROOM_FULL', 'ROOM_NOT_FOUND', 'REFUSED'] as const)(
    'tries once more when the offered room is gone or taken (%s)',
    async (code) => {
      // FloorFifty "tries once more when the room it was offered has just closed" and "… just filled".
      const h = await start()
      h.fake.respond('joinOrCreate', new Error(`${code}: gone`))
      await h.run(h.room.quickMatch({ name: 'Ada' }))
      expect(h.fake.calls.map((call) => call.method)).toEqual(['joinOrCreate', 'joinOrCreate'])
      expect(h.connection()).toBe('connected')
    },
  )

  it('says so when the second try is refused too, and tries no third time', async () => {
    // FloorFifty "says so in the game's words when the second try is refused too, and tries no third time".
    const h = await start()
    h.fake.respondAlways('joinOrCreate', new Error('room "ABC234" is locked'))
    const exit = await h.exit(h.room.quickMatch({ name: 'Ada' }))
    expect(failureCode(exit)).toMatchObject({ code: 'ROOM_FULL', operation: 'quickMatch' })
    expect(h.fake.calls).toHaveLength(2)
    expect(h.connection()).toBe('offline')
  })

  it('does not retry a refusal that is not about the room', async () => {
    // FloorFifty "does not retry a refusal that is not about the room".
    const h = await start()
    h.fake.respond('joinOrCreate', new Error('VERSION_MISMATCH: this game is out of date: reload to play'))
    const exit = await h.exit(h.room.quickMatch({ name: 'Ada' }))
    expect(failureCode(exit)).toMatchObject({ code: 'VERSION_MISMATCH' })
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
    // FloorFifty "reads the refusal %j as %s" and "reports a refused version as the error the recovery view renders".
    const h = await start()
    h.fake.respond('create', new Error(message))
    const exit = await h.exit(h.room.create({ name: 'Ada' }))
    expect(failureCode(exit)).toMatchObject({ code, operation: 'create' })
    expect(h.connection()).toBe('offline')
    expect(h.info()).toBeUndefined()
  })

  it('reads a server it cannot reach as offline', async () => {
    const h = await start()
    h.fake.respond('joinById', new TypeError('fetch failed'))
    const exit = await h.exit(h.room.join('ABC234', { name: 'Ada' }))
    expect(failureCode(exit)).toMatchObject({ code: 'OFFLINE', operation: 'join' })
  })
})

describe('the room info', () => {
  it('mirrors the room state, and your seat once the room says it', async () => {
    const h = await start()
    await h.run(h.room.create({ name: 'Ada' }))
    expect(h.info()).toMatchObject({ code: 'ABC234', phase: 'lobby', you: undefined, hostSeat: 0 })
    const room = h.fake.rooms[0]
    room?.message({ t: 'seated', seat: 0 })
    expect(h.info()?.you).toBe(0)
    room?.patch(h.fake.state('ABC234', { phase: 'countdown' }))
    expect(h.info()).toMatchObject({ phase: 'countdown', you: 0 })
  })

  it('keeps the info it showed while a patch does not parse', async () => {
    const h = await start()
    await h.run(h.room.create({ name: 'Ada' }))
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
    await h.run(h.room.create({ name: 'Ada' }))
    const fiber = h.start(h.room.setReady(true))
    await h.settle()
    const [message] = requested(h)
    expect(message).toMatchObject({ t: 'ready', ready: true })
    expect(message.req).toMatch(/^load0001-r\d+$/)
    h.fake.rooms[0]?.message({ t: 'answer', req: message.req })
    expect(Exit.isSuccess(await h.run(fiber.await))).toBe(true)
  })

  it('fails a refused request with the room’s code, and the room carries on', async () => {
    // reconnect.test "does not leave the race for a failure it can continue through".
    const h = await start()
    await h.run(h.room.create({ name: 'Ada' }))
    const fiber = h.start(h.room.addBot())
    await h.settle()
    h.fake.rooms[0]?.message({ t: 'answer', req: requested(h)[0].req, error: 'RATE_LIMITED' })
    expect(failureCode(await h.run(fiber.await))).toMatchObject({ code: 'RATE_LIMITED', operation: 'addBot' })
    expect(h.connection()).toBe('connected')
    expect(h.ended()).toBeUndefined()
  })

  it('removes a bot by its seat', async () => {
    const h = await start()
    await h.run(h.room.create({ name: 'Ada' }))
    h.start(h.room.removeBot(2))
    await h.settle()
    expect(requested(h)[0]).toMatchObject({ t: 'bot.remove', seat: 2 })
  })

  it('fails a request with no room as offline', async () => {
    const h = await start()
    expect(failureCode(await h.exit(h.room.setReady(true)))).toMatchObject({
      code: 'OFFLINE',
      operation: 'setReady',
    })
  })

  it('fails a request whose answer was lost when the room is left', async () => {
    // FloorFifty "rejects a command whose answer was lost when the room is left".
    const h = await start()
    await h.run(h.room.create({ name: 'Ada' }))
    const fiber = h.start(h.room.setReady(true))
    await h.settle()
    await h.run(h.room.leave)
    expect(failureCode(await h.run(fiber.await))).toMatchObject({ code: 'OFFLINE' })
  })
})
