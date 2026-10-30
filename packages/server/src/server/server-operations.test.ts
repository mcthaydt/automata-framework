import { EventEmitter } from 'node:events'
import { NET_CHANNEL, ROOM_NAME } from '@mcthaydt/automata-net'
import { netPlugin } from '@mcthaydt/automata-net/sim'
import { definePlugin } from '@mcthaydt/automata-sim'
import { Effect, Exit } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineServer } from '../game/server-game'
import { createFakeVerifier, type FakeVerifier } from '../session/session-verifier'
import {
  joinOptions,
  settle,
  startTestServer,
  TEST_LIMITS,
  type TestServer,
  waitFor,
} from '../test-support/colyseus-harness'
import { TEST_NET } from '../test-support/engine-harness'
import { fixtureGame, fixtureServer, Move, walkPlugin } from '../test-support/fixture-game'
import { createLogWriter } from './log-writer'
import { installCrashHandlers } from './process-safety'
import { serverLogLine } from './server-log-line.schema'
import { createServerRuntime } from './start-server'

// The server's operations end to end on an ephemeral port (M7 spec §4.3, §4.5, §6; §13 SV-f, SV-g, SV-h): session
// verification before a seat, redacted log lines over the whole join, play, refuse and crash paths, and the probes.
// Every token, name and address here is an obvious fake.

let server: TestServer | undefined
afterEach(async () => {
  vi.restoreAllMocks()
  await server?.close()
  server = undefined
})

const ONE_MINUTE_ON = (): number => Date.now() + 60_000

async function startWithFake(
  extra: Parameters<typeof startTestServer>[0] = {},
): Promise<{ test: TestServer; fake: FakeVerifier }> {
  const fake = createFakeVerifier()
  const test = await startTestServer({ ...extra, config: { verifier: fake, ...extra.config } })
  return { test, fake }
}

/** The slice of an SDK room these tests use. */
interface SdkRoom {
  readonly roomId: string
  send(type: string, payload: unknown): void
}

/** Creates a room with a session token; the room seats the client on its next tick. */
async function createWith(test: TestServer, name: string, session: string): Promise<SdkRoom> {
  return (await test.colyseus.sdk.create(ROOM_NAME, { ...joinOptions(name), session })) as unknown as SdkRoom
}

/** Sends one wire message as a client does: JSON text on net's channel. */
const say = (room: SdkRoom, message: Record<string, unknown>): void =>
  room.send(NET_CHANNEL, JSON.stringify(message))

describe('SV-f: session verification', () => {
  it('refuses a forged token UNVERIFIED before a room exists, and logs the refusal', async () => {
    const { test } = await startWithFake()
    server = test
    await expect(
      test.colyseus.sdk.create(ROOM_NAME, { ...joinOptions('Ada'), session: 'FAKE-FORGED-not-a-secret' }),
    ).rejects.toThrow(/UNVERIFIED/)
    expect(test.runtime.rooms.size).toBe(0)
    expect(test.logs).toContainEqual({ event: 'refused', code: 'session' })
  })

  it('refuses an expired token UNVERIFIED, and a join without a token', async () => {
    const { test, fake } = await startWithFake()
    server = test
    const expired = fake.issue('player-a', { expiresAtMs: 0 })
    await expect(
      test.colyseus.sdk.create(ROOM_NAME, { ...joinOptions('Ada'), session: expired }),
    ).rejects.toThrow(/UNVERIFIED/)
    await expect(test.colyseus.sdk.create(ROOM_NAME, joinOptions('Ada'))).rejects.toThrow(/UNVERIFIED/)
    expect(test.runtime.rooms.size).toBe(0)
  })

  it('seats a player with an issued token, and refuses a forged one into the same room without seating it', async () => {
    const { test, fake } = await startWithFake()
    server = test
    const { roomId: code } = await createWith(
      test,
      'Ada',
      fake.issue('player-a', { expiresAtMs: ONE_MINUTE_ON() }),
    )
    await test.step(code, 1)
    await expect(
      test.colyseus.sdk.joinById(code, { ...joinOptions('Bea'), session: 'fake-session-0-1' }),
    ).rejects.toThrow(/UNVERIFIED/)
    await test.step(code, 1)
    expect(
      test
        .room(code)
        .engine.info()
        .seats.map((seat) => seat.name),
    ).toEqual(['Ada'])
  })

  it('seats a join with no token under the anonymous verifier (M7-D7)', async () => {
    server = await startTestServer()
    const host = await server.create('Ada')
    expect(host.of('seated')).toHaveLength(1)
  })
})

describe('SV-g: no planted secret reaches stdout', () => {
  const PLANTED_NAME = 'PlantedKite'
  const PLANTED_IP = '203.0.113.77'
  const PLANTED_BEARER = 'FAKE-BEARER-not-a-secret-0003'
  const PLANTED_FORGED = 'FAKE-FORGED-not-a-secret-0004'
  const PLANTED_PAYLOAD = 'FAKE-PAYLOAD-not-a-secret-0005'

  it('writes only schema lines over the join, play, refuse and crash paths, none holding a planted value', async () => {
    const printed: string[] = []
    const record =
      (original: (...args: never[]) => unknown) =>
      (...args: unknown[]): never => {
        printed.push(args.map(String).join(' '))
        return (original as (...args: unknown[]) => never)(...args)
      }
    // Each original is taken before its spy replaces it, so the spy prints through and records.
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
      const original = console[method].bind(console)
      vi.spyOn(console, method).mockImplementation(record(original))
    }
    const stdout = process.stdout.write.bind(process.stdout)
    const stderr = process.stderr.write.bind(process.stderr)
    vi.spyOn(process.stdout, 'write').mockImplementation(record(stdout))
    vi.spyOn(process.stderr, 'write').mockImplementation(record(stderr))

    const lines: string[] = []
    const log = createLogWriter({ write: (line) => lines.push(line), now: () => Date.now() })
    const { test, fake } = await startWithFake({ config: { log } })
    server = test
    const token = fake.issue('player-a', { expiresAtMs: ONE_MINUTE_ON() })
    const guestToken = fake.issue('player-b', { expiresAtMs: ONE_MINUTE_ON() })

    // Join: a planted name and token, and the room code the server hands out.
    const host = await createWith(test, PLANTED_NAME, token)
    const code = host.roomId
    await test.step(code, 1)
    // Refuse: a forged token into the room while it still has a seat.
    await expect(
      test.colyseus.sdk.joinById(code, { ...joinOptions(PLANTED_NAME), session: PLANTED_FORGED }),
    ).rejects.toThrow(/UNVERIFIED/)
    const guest = (await test.colyseus.sdk.joinById(code, {
      ...joinOptions('Bea'),
      session: guestToken,
    })) as unknown as SdkRoom
    await test.step(code, 1)
    const room = test.room(code)

    // Refuse: a matchmaking request carrying a bearer header and a forwarded address.
    for (const path of [`/matchmake/joinById/${code}`, `/matchmake/create/${ROOM_NAME}`]) {
      await fetch(`http://127.0.0.1:${test.runtime.port}${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${PLANTED_BEARER}`,
          'x-forwarded-for': PLANTED_IP,
        },
        body: JSON.stringify({ ...joinOptions(PLANTED_NAME), session: PLANTED_FORGED }),
      }).then((response) => response.text())
    }

    // Play, and a message the room refuses, its payload planted.
    say(host, { t: 'ready', ready: true, req: 'r0' })
    say(guest, { t: 'ready', ready: true, req: 'r1' })
    await settle()
    for (let guard = 0; guard < 100 && room.engine.lobby.phase !== 'playing'; guard += 1)
      await test.step(code, 1)
    expect(room.engine.lobby.phase).toBe('playing')
    const tick = room.engine.tick
    say(host, { t: 'cmd', seq: 0, tick, type: Move.id, payload: { dx: 1 } })
    say(guest, { t: 'cmd', seq: 0, tick, type: 'not.a.command', payload: { note: PLANTED_PAYLOAD } })
    await test.step(code, 3)

    // Crash: an error whose message carries every planted value.
    const crashes = new EventEmitter()
    const exits: number[] = []
    installCrashHandlers(crashes, log, (exitCode) => exits.push(exitCode))
    crashes.emit('uncaughtException', new TypeError(`${PLANTED_NAME} ${token} ${PLANTED_IP} ${code}`))
    expect(exits).toEqual([1])
    await settle()

    const written = lines.join('')
    expect(lines.length).toBeGreaterThan(5)
    for (const line of lines) expect(serverLogLine.safeParse(JSON.parse(line)).success).toBe(true)
    for (const event of ['room.created', 'seat.joined', 'refused', 'fatal'])
      expect(written).toContain(`"event":"${event}"`)
    expect(written).toContain('"code":"session"')
    const everything = `${written}\n${printed.join('\n')}`
    for (const secret of [
      PLANTED_NAME,
      PLANTED_IP,
      PLANTED_BEARER,
      PLANTED_FORGED,
      PLANTED_PAYLOAD,
      token,
      guestToken,
      code,
    ])
      expect(everything).not.toContain(secret)
  })
})

describe('SV-h: health and readiness', () => {
  const probe = async (port: number, path: string) => {
    const response = await fetch(`http://127.0.0.1:${port}${path}`)
    return { status: response.status, body: (await response.json()) as unknown }
  }

  it('is ready once started, and not ready while draining a game in play, while /health stays 200', async () => {
    server = await startTestServer({ config: { drainCapMs: 600_000 } })
    const port = server.runtime.port
    const test = server
    await waitFor(() => test.runtime.readiness === 'ready', 'the server never became ready')
    expect(await probe(port, '/ready')).toEqual({ status: 200, body: { ready: true } })
    expect(await probe(port, '/health')).toEqual({ status: 200, body: { ok: true } })
    expect(server.runtime.readiness).toBe('ready')
    expect(server.logs).toContainEqual({ event: 'server.started' })

    const host = await server.create('Ada')
    const guest = await server.joinById(host.code, 'Bea')
    host.send({ t: 'ready', ready: true, req: 'go-0' })
    guest.send({ t: 'ready', ready: true, req: 'go-1' })
    await waitFor(() => guest.of('answer').length > 0 && host.of('answer').length > 0, 'no ready answer')
    const room = server.room(host.code)
    for (let guard = 0; guard < 100 && room.engine.lobby.phase !== 'playing'; guard += 1)
      await server.step(host.code, 1)
    const drained = Effect.runPromise(server.runtime.drain)

    expect(await probe(port, '/ready')).toEqual({ status: 503, body: { ready: false } })
    expect(await probe(port, '/health')).toEqual({ status: 200, body: { ok: true } })
    await host.leave(true)
    await guest.leave(true)
    await waitFor(() => room.engine.info().seats.length === 0, 'the seats were never freed')
    await server.step(host.code, 1)
    expect(await drained).toBe('empty')
  })

  it('is not ready before its content has loaded, and ready once it has', async () => {
    let open = (): void => undefined
    const gate = new Promise<void>((resolve) => {
      open = resolve
    })
    // A plugin whose engine takes its time: the content has not loaded until the gate opens.
    const slow = definePlugin({
      name: 'slow',
      state: async () => {
        await gate
        return {
          snapshot: () => new Uint8Array(),
          prepareRestore: () => ({ commit: () => undefined, discard: () => undefined }),
          dispose: () => undefined,
        }
      },
    })
    server = await startTestServer({
      def: defineServer({ ...fixtureGame, plugins: [netPlugin, walkPlugin, slow] }),
    })
    const port = server.runtime.port
    expect(await probe(port, '/ready')).toEqual({ status: 503, body: { ready: false } })
    expect(await probe(port, '/health')).toEqual({ status: 200, body: { ok: true } })
    expect(server.runtime.readiness).toBe('starting')
    open()
    const test = server
    await waitFor(() => test.runtime.readiness === 'ready', 'the server never became ready')
    expect(await probe(port, '/ready')).toEqual({ status: 200, body: { ready: true } })
  })

  it('never becomes ready when the game’s content does not load, and says so in a fatal line', async () => {
    const unreadable = {
      get goal(): number {
        throw new Error('the content is unreadable')
      },
    }
    server = await startTestServer({ def: fixtureServer({ content: unreadable }) })
    const test = server
    await waitFor(() => test.logs.some((event) => event.event === 'start.refused'), 'no start.refused line')
    expect(test.logs).toContainEqual({ event: 'start.refused', code: 'content' })
    expect(await probe(test.runtime.port, '/ready')).toEqual({ status: 503, body: { ready: false } })
    expect(await probe(test.runtime.port, '/health')).toEqual({ status: 200, body: { ok: true } })
  })
})

describe('process safety at start', () => {
  it('refuses a test switch in production, naming it, before it listens', async () => {
    const exit = await Effect.runPromiseExit(
      Effect.scoped(
        createServerRuntime(fixtureServer(), {
          port: 0,
          limits: { ...TEST_LIMITS, allowedOrigins: ['https://game.example.test'] },
          net: TEST_NET,
          env: { NODE_ENV: 'production' },
          seed: 11,
          manualClock: true,
        }),
      ),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toMatch(/seed, manualClock/)
  })
})
