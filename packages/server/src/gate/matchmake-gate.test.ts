import { Effect } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import type { ServerLimits } from '../game/server-config'
import type { AutomataRoom } from '../room/automata-room'
import { startTestServer, TEST_LIMITS, TEST_ORIGIN, type TestServer } from '../test-support/colyseus-harness'

// Everything a matchmaking request passes before Colyseus sees it (FloorFifty tests/server/gate/
// matchmake-gate.test.ts, eight cases; spec §6 rate limits and draining, SV-c). FloorFifty's limits were constants;
// here they are config, so each case gives the server the buckets it is about.

let server: TestServer | undefined
afterEach(async () => {
  await server?.close()
  server = undefined
})

const start = (perIp: Partial<ServerLimits['perIp']> = {}, over: Partial<ServerLimits> = {}) =>
  startTestServer({
    config: { limits: { ...TEST_LIMITS, maxRooms: 8, ...over, perIp: { ...TEST_LIMITS.perIp, ...perIp } } },
  })

const errorOf = async (response: Response): Promise<string> => {
  const body = (await response.json().catch(() => ({}))) as { error?: unknown }
  return String(body.error ?? '')
}

const statuses = async (count: number, request: () => Promise<Response>): Promise<number[]> => {
  const out: number[] = []
  for (let index = 0; index < count; index += 1) out.push((await request()).status)
  return out
}

describe('the matchmaking gate', () => {
  it("lets an address open create.burst rooms at once, then refuses RATE_LIMITED with the page's CORS", async () => {
    server = await start({ create: { burst: 3, perSecond: 0.05 } })
    const test = server
    expect(await statuses(3, () => test.matchmake('create', test.joinOptions('Ada')))).toEqual([
      200, 200, 200,
    ])
    const fourth = await test.matchmake('create', test.joinOptions('Ada'))
    expect(fourth.status).toBe(429)
    expect(await errorOf(fourth)).toMatch(/^RATE_LIMITED: /)
    expect(fourth.headers.get('access-control-allow-origin')).toBe(TEST_ORIGIN)
    expect(test.runtime.rooms.size).toBe(3)
  })

  // Quick match may open a room, so it has its own bucket rather than Create's: FloorFifty's Find a race.
  it('limits Quick match on its own bucket, apart from Create', async () => {
    server = await start({ create: { burst: 1, perSecond: 0.05 }, quickMatch: { burst: 8, perSecond: 0.1 } })
    const test = server
    const quick = await statuses(9, () => test.matchmake('joinOrCreate', test.joinOptions('Ada')))
    expect(quick.slice(0, 8).every((status) => status === 200)).toBe(true)
    expect(quick[8]).toBe(429)
    expect((await test.matchmake('create', test.joinOptions('Ada'))).status).toBe(200)
  })

  it('lets an address try join.burst codes at once, then refuses the next', async () => {
    server = await start({ join: { burst: 10, perSecond: 0.5 } })
    const test = server
    for (let index = 0; index < 10; index += 1) {
      const response = await test.matchmake('joinById', test.joinOptions('Ada'), 'ZZZZZZ')
      expect(await errorOf(response)).not.toMatch(/RATE_LIMITED/)
    }
    const eleventh = await test.matchmake('joinById', test.joinOptions('Ada'), 'ZZZZZZ')
    expect(eleventh.status).toBe(429)
  })

  // FloorFifty Review Focus 2: a family pressing Quick match together. maxRooms bounds the rooms either way.
  it('lets four players behind one router all Quick match at once', async () => {
    server = await start({ create: { burst: 3, perSecond: 0.05 }, quickMatch: { burst: 8, perSecond: 0.1 } })
    const test = server
    expect(await statuses(4, () => test.matchmake('joinOrCreate', test.joinOptions('Ada')))).toEqual([
      200, 200, 200, 200,
    ])
  })

  it('lets four players behind one router join and reconnect eight times between them', async () => {
    server = await start({ join: { burst: 10, perSecond: 0.5 }, reconnect: { burst: 8, perSecond: 0.2 } })
    const test = server
    const answers: string[] = []
    for (let index = 0; index < 4; index += 1)
      answers.push(await errorOf(await test.matchmake('joinById', test.joinOptions('Ada'), 'ZZZZZZ')))
    for (let index = 0; index < 8; index += 1)
      answers.push(
        await errorOf(await test.matchmake('reconnect', { reconnectionToken: 'not-a-token' }, 'ZZZZZZ')),
      )
    expect(answers.filter((answer) => /RATE_LIMITED/.test(answer))).toEqual([])
  })

  // FloorFifty switched its limits off for a server with the test driver mounted. Plus has no such switch (M7.4b
  // refuses test switches in production): the limits are config, and a test server sets wide ones.
  it("follows a test server's own wide buckets: one address opens six rooms", async () => {
    server = await start({ create: { burst: 100, perSecond: 100 } })
    const test = server
    expect(await statuses(6, () => test.matchmake('create', test.joinOptions('Ada')))).toEqual([
      200, 200, 200, 200, 200, 200,
    ])
  })

  it('refuses a matchmaking body over maxMessageBytes with 413', async () => {
    server = await start({}, { maxMessageBytes: 4_096 })
    const response = await server.matchmake('create', {
      ...server.joinOptions('Ada'),
      padding: 'x'.repeat(5_000),
    })
    expect(response.status).toBe(413)
    expect(server.runtime.rooms.size).toBe(0)
  })

  it('lets a reconnection through while the server drains, and refuses a new room SERVER_UPDATING', async () => {
    server = await start({}, {})
    const test = server
    // A room that stays, so the drain is still waiting while the test asks.
    const staying = { beginDrain: () => undefined } as unknown as AutomataRoom
    test.runtime.rooms.register(staying)
    const drained = Effect.runPromise(test.runtime.drain)
    const reconnect = await test.matchmake('reconnect', { reconnectionToken: 'not-a-token' }, 'ZZZZZZ')
    expect(await errorOf(reconnect)).not.toMatch(/SERVER_UPDATING|RATE_LIMITED/)
    const fresh = await test.matchmake('create', test.joinOptions('Bea'))
    expect(fresh.status).toBe(503)
    expect(await errorOf(fresh)).toMatch(/^SERVER_UPDATING: /)
    test.runtime.rooms.forget(staying)
    expect(await drained).toBe('empty')
  })
})
