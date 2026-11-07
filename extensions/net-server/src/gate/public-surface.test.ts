import { definePlugin } from '@mcthaydt/automata-sim'
import { Effect, Exit } from 'effect'
import { afterEach, describe, expect, it } from 'vitest'
import type { ServerLimits } from '../game/server-config'
import type { AutomataRoom } from '../room/automata-room'
import { createServerRuntime } from '../server/start-server'
import {
  startTestServer,
  TEST_LIMITS,
  TEST_ORIGIN,
  type TestServer,
  waitFor,
} from '../test-support/colyseus-harness'
import { TEST_NET } from '../test-support/engine-harness'
import { fixtureGame, fixtureServer } from '../test-support/fixture-game'
import { halfOpenRefusal, upgradeStatus } from '../test-support/raw-upgrade'

// The server's public surface (FloorFifty tests/server/gate/public-surface.test.ts, eleven cases; spec §6 origins,
// sockets and the room cap, SV-c, SV-d). FloorFifty's /content and /health are not this row's (Plus serves no
// /content; /health is M7.4b's), so their two origin cases are answered on matchmaking's own preflight and refusals.

const OTHER = 'https://elsewhere.test'
let server: TestServer | undefined
afterEach(async () => {
  await server?.close()
  server = undefined
})

const start = (over: Partial<ServerLimits> = {}, def = fixtureServer({ seats: { min: 1, max: 4 } })) =>
  startTestServer({ def, config: { limits: { ...TEST_LIMITS, ...over } } })

const preflight = (test: TestServer, origin: string) =>
  fetch(`${test.base}/matchmake/create/automata`, {
    method: 'OPTIONS',
    headers: { origin, 'access-control-request-method': 'POST' },
  })

const errorOf = async (response: Response): Promise<string> =>
  String(((await response.json().catch(() => ({}))) as { error?: unknown }).error ?? '')

describe("the public surface's origins", () => {
  it("answers matchmaking's preflight for a listed origin, and gives another none", async () => {
    server = await start()
    const listed = await preflight(server, TEST_ORIGIN)
    expect(listed.headers.get('access-control-allow-origin')).toBe(TEST_ORIGIN)
    const other = await preflight(server, OTHER)
    expect(other.headers.get('access-control-allow-origin') ?? '').toBe('')
  })

  it("writes a refusal an unlisted page cannot read, and a listed page's it can", async () => {
    server = await start({ perIp: { ...TEST_LIMITS.perIp, create: { burst: 1, perSecond: 0.01 } } })
    const other = await server.matchmake('create', server.joinOptions('Ada'), undefined, OTHER)
    expect(other.status).toBe(403)
    expect(other.headers.get('access-control-allow-origin')).toBeNull()
    expect(other.headers.get('vary')).toBe('Origin')
    await server.matchmake('create', server.joinOptions('Ada'))
    const limited = await server.matchmake('create', server.joinOptions('Ada'))
    expect(limited.status).toBe(429)
    expect(limited.headers.get('access-control-allow-origin')).toBe(TEST_ORIGIN)
  })

  // SV-d: "a request from an origin not in allowedOrigins is refused".
  it('refuses matchmaking from an unlisted origin, or from none, and opens no room; a listed origin gets in', async () => {
    server = await start()
    for (const origin of [OTHER, null]) {
      const refused = await server.matchmake('create', server.joinOptions('Ada'), undefined, origin)
      expect(refused.status).toBe(403)
      expect(await errorOf(refused)).toMatch(/^REFUSED: /)
    }
    expect(server.runtime.rooms.size).toBe(0)
    const listed = await server.matchmake('create', server.joinOptions('Ada'))
    expect(listed.status).toBe(200)
    expect(listed.headers.get('access-control-allow-origin')).toBe(TEST_ORIGIN)
  })

  it('refuses a socket from an unlisted origin, or from none, before Colyseus sees it', async () => {
    server = await start()
    expect(await upgradeStatus(server.runtime.port, OTHER)).toBe(403)
    expect(await upgradeStatus(server.runtime.port, null)).toBe(403)
    // A listed origin is handed on: whatever Colyseus makes of the path, it is not our refusal.
    expect(await upgradeStatus(server.runtime.port, TEST_ORIGIN)).toBe(101)
    expect(server.runtime.sockets.open).toBeLessThanOrEqual(1)
  })

  // Review: a refused upgrade from a client that never closes its end must not stay open on the server.
  it('closes a refused socket from its own side, whatever the client does', async () => {
    server = await start()
    expect(await halfOpenRefusal(server.runtime.port, 'https://elsewhere.test')).toEqual({
      status: 403,
      closedByServer: true,
    })
  })

  // FloorFifty allowed every origin when none was listed, as in dev; SV-d refuses to start instead.
  it('refuses to start with no origin listed, naming allowedOrigins', async () => {
    const config = { port: 0, limits: { ...TEST_LIMITS, allowedOrigins: [] }, net: TEST_NET }
    const exit = await Effect.runPromiseExit(Effect.scoped(createServerRuntime(fixtureServer(), config)))
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toMatch(/allowedOrigins is empty/)
  })
})

describe('the socket caps through the server', () => {
  it("refuses an address's socket past its cap, and lets one in again once one closes", async () => {
    server = await start({ socketsPerIp: 2 })
    const host = await server.create('Ada')
    const guest = await server.joinById(host.code, 'Bea')
    expect(server.runtime.sockets.open).toBe(2)
    expect(await upgradeStatus(server.runtime.port, TEST_ORIGIN)).toBe(429)
    await guest.leave(true)
    const test = server
    await waitFor(() => test.runtime.sockets.open === 1, 'the closed socket never gave its place back')
    expect(await upgradeStatus(server.runtime.port, TEST_ORIGIN)).toBe(101)
  })

  // SV-c: "a 17th socket from one address is refused and the other 16 are unaffected", at a cap of 2.
  it("leaves an address's open sockets playing when its next socket is refused", async () => {
    server = await start({ socketsPerIp: 2 })
    const host = await server.create('Ada')
    const guest = await server.joinById(host.code, 'Bea')
    expect(await upgradeStatus(server.runtime.port, TEST_ORIGIN)).toBe(429)
    for (const client of [host, guest]) client.send({ t: 'ping', id: 7, tick: -1 })
    await waitFor(
      () => host.of('pong').length > 0 && guest.of('pong').length > 0,
      'a held socket stopped answering',
    )
    expect([host.closedWith, guest.closedWith]).toEqual([undefined, undefined])
  })

  // For FloorFifty's "past the total": a held bare socket closes after Colyseus's one second, so the total is
  // tested on the upgrade gate (upgrade-gate.test.ts) and this case takes the message cap.
  it('drops a message past maxMessageBytes before parsing, logs it, and keeps the client; the transport closes a far larger frame', async () => {
    server = await start({ maxMessageBytes: 1_024 })
    const host = await server.create('Ada')
    const guest = await server.joinById(host.code, 'Bea')
    host.send({ t: 'ping', id: 1, tick: -1, padding: 'x'.repeat(1_100) } as never)
    host.send({ t: 'ping', id: 2, tick: -1 })
    await waitFor(() => host.of('pong').length > 0, 'the client was not answered after its oversized message')
    expect(host.of('pong').map((pong) => pong.id)).toEqual([2])
    expect(server.logs).toContainEqual({ event: 'refused', room: expect.any(String), seat: 0, code: 'size' })
    expect(host.closedWith).toBeUndefined()
    guest.send({ t: 'ping', id: 3, tick: -1, padding: 'x'.repeat(4_096) } as never)
    await waitFor(() => guest.closedWith !== undefined, 'the transport kept a frame far past the cap')
  })
})

describe('a room that fails to start, and the drain', () => {
  it('holds no maxRooms slot once its creation fails', async () => {
    // The server's own sim (its version) is built; every room's sim after it throws.
    let sims = 0
    const broken = definePlugin({
      name: 'broken',
      state: async () => {
        sims += 1
        if (sims > 1) throw new Error('broken on purpose')
        return {
          snapshot: () => new Uint8Array(),
          prepareRestore: () => ({ commit() {}, discard() {} }),
          dispose() {},
        }
      },
    })
    server = await start({ maxRooms: 1 }, fixtureServer({ plugins: [...fixtureGame.plugins, broken] }))
    const failed = await server.matchmake('create', server.joinOptions('Ada'))
    expect(failed.status).not.toBe(200)
    const test = server
    await waitFor(() => test.runtime.rooms.size === 0, 'the failed room kept its slot')
    expect(sims).toBe(2)
  })

  it('still tells every other room to drain when one of them throws', async () => {
    server = await startTestServer({ config: { drainCapMs: 1 } })
    const told: string[] = []
    const throwing = {
      beginDrain: () => {
        throw new Error('broken room')
      },
    } as unknown as AutomataRoom
    server.runtime.rooms.register(throwing)
    server.runtime.rooms.register({ beginDrain: () => void told.push('healthy') } as unknown as AutomataRoom)
    expect(await Effect.runPromise(server.runtime.drain)).toBe('cap')
    expect(told).toEqual(['healthy'])
  })

  it('refuses a room past maxRooms with SERVER_BUSY', async () => {
    server = await start({ maxRooms: 2 })
    const test = server
    const create = () => test.matchmake('create', test.joinOptions('Ada'))
    expect((await create()).status).toBe(200)
    expect((await create()).status).toBe(200)
    const third = await create()
    expect(third.status).not.toBe(200)
    expect(await errorOf(third)).toMatch(/^SERVER_BUSY: /)
  })
})
