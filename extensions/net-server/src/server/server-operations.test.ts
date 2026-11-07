import { EventEmitter } from 'node:events'
import { createServer } from 'node:net'
import { NET_CHANNEL, ROOM_NAME } from '@automata/net'
import { netPlugin } from '@automata/net/sim'
import { definePlugin } from '@automata/sim'
import { Client } from '@colyseus/sdk'
import { Effect, Exit, Fiber, Scope } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { defineServer } from '../game/server-game'
import { gameVersionOf } from '../gate/matchmake-version-gate'
import { createFakeVerifier, type FakeVerifier } from '../session/session-verifier'
import {
  joinOptions as joinOptionsFor,
  settle,
  startTestServer,
  TEST_LIMITS,
  TEST_ORIGIN,
  type TestServer,
  waitFor,
} from '../test-support/colyseus-harness'
import { TEST_NET } from '../test-support/engine-harness'
import { fixtureGame, fixtureServer, Move, walkPlugin } from '../test-support/fixture-game'
import { createLogWriter } from './log-writer'
import { installCrashHandlers } from './process-safety'
import { serverLogLine } from './server-log-line.schema'
import { runServerProcess } from './server-process'
import { createServerRuntime } from './start-server'

// The server's operations end to end on an ephemeral port (M7 spec §4.3, §4.5, §6; §13 SV-f, SV-g, SV-h): session
// verification before a seat, redacted log lines over the whole join, play, refuse and crash paths, and the probes.
// Every token, name and address here is an obvious fake.

let server: TestServer | undefined
afterEach(async () => {
  vi.restoreAllMocks()
  vi.unstubAllEnvs()
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
  request(type: string, payload: unknown): Promise<unknown>
  leave(consented?: boolean): Promise<number>
}

/** Everything printed while a test runs, by console and stream, each still printed through. */
function spyOnOutput(): { readonly all: string[]; readonly stdout: string[] } {
  const all: string[] = []
  const stdoutWrites: string[] = []
  const record =
    (original: (...args: never[]) => unknown, into?: string[]) =>
    (...args: unknown[]): never => {
      const text = args.map(String).join(' ')
      all.push(text)
      into?.push(text)
      return (original as (...args: unknown[]) => never)(...args)
    }
  // Each original is taken before its spy replaces it, so the spy prints through and records.
  for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) {
    const original = console[method].bind(console)
    vi.spyOn(console, method).mockImplementation(record(original))
  }
  const stdout = process.stdout.write.bind(process.stdout)
  const stderr = process.stderr.write.bind(process.stderr)
  vi.spyOn(process.stdout, 'write').mockImplementation(record(stdout, stdoutWrites))
  vi.spyOn(process.stderr, 'write').mockImplementation(record(stderr))
  return { all, stdout: stdoutWrites }
}

/** A port the system says is free now, for a process whose entry does not report the port it bound. */
const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0
      probe.close(() => resolve(port))
    })
  })

/** Creates a room with a session token; the room seats the client on its next tick. */
async function createWith(test: TestServer, name: string, session: string): Promise<SdkRoom> {
  return (await test.colyseus.sdk.create(ROOM_NAME, {
    ...test.joinOptions(name),
    session,
  })) as unknown as SdkRoom
}

/** Sends one wire message as a client does: JSON text on net's channel. */
const say = (room: SdkRoom, message: Record<string, unknown>): void =>
  room.send(NET_CHANNEL, JSON.stringify(message))

describe('SV-f: session verification', () => {
  it('refuses a forged token UNVERIFIED before a room exists, and logs the refusal', async () => {
    const { test } = await startWithFake()
    server = test
    await expect(
      test.colyseus.sdk.create(ROOM_NAME, {
        ...test.joinOptions('Ada'),
        session: 'FAKE-FORGED-not-a-secret',
      }),
    ).rejects.toThrow(/UNVERIFIED/)
    expect(test.runtime.rooms.size).toBe(0)
    expect(test.logs).toContainEqual({ event: 'refused', code: 'session' })
  })

  it('refuses an expired token UNVERIFIED, and a join without a token', async () => {
    const { test, fake } = await startWithFake()
    server = test
    const expired = fake.issue('player-a', { expiresAtMs: 0 })
    await expect(
      test.colyseus.sdk.create(ROOM_NAME, { ...test.joinOptions('Ada'), session: expired }),
    ).rejects.toThrow(/UNVERIFIED/)
    await expect(test.colyseus.sdk.create(ROOM_NAME, test.joinOptions('Ada'))).rejects.toThrow(/UNVERIFIED/)
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
      test.colyseus.sdk.joinById(code, { ...test.joinOptions('Bea'), session: 'fake-session-0-1' }),
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

  it('writes only schema lines over the join, play, refuse, handler-fault, drain and crash paths, none holding a planted value', async () => {
    const printed = spyOnOutput().all

    const lines: string[] = []
    const log = createLogWriter({ write: (line) => lines.push(line), now: () => Date.now() })
    // A short drain cap: the drain below ends on it, with a game still in play.
    const { test, fake } = await startWithFake({ config: { log, drainCapMs: 200 } })
    server = test
    const token = fake.issue('player-a', { expiresAtMs: ONE_MINUTE_ON() })
    const guestToken = fake.issue('player-b', { expiresAtMs: ONE_MINUTE_ON() })

    // Join: a planted name and token, and the room code the server hands out.
    const host = await createWith(test, PLANTED_NAME, token)
    const code = host.roomId
    await test.step(code, 1)
    // Refuse: a forged token into the room while it still has a seat.
    await expect(
      test.colyseus.sdk.joinById(code, { ...test.joinOptions(PLANTED_NAME), session: PLANTED_FORGED }),
    ).rejects.toThrow(/UNVERIFIED/)
    const guest = (await test.colyseus.sdk.joinById(code, {
      ...test.joinOptions('Bea'),
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
          origin: TEST_ORIGIN,
          authorization: `Bearer ${PLANTED_BEARER}`,
          'x-forwarded-for': PLANTED_IP,
        },
        body: JSON.stringify({ ...test.joinOptions(PLANTED_NAME), session: PLANTED_FORGED }),
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

    // A handler fault: a request whose handler throws reaches Colyseus's `debugAndPrintError`, which hands the error's
    // stack, planted values and room code in it, to the logger.
    room.onMessage('boom', () => {
      throw new TypeError(`${PLANTED_PAYLOAD} ${PLANTED_NAME} ${code}`)
    })
    await expect(host.request('boom', { note: PLANTED_PAYLOAD })).rejects.toThrow()
    expect(lines.join('')).toContain('"event":"colyseus.error"')

    // Drain: SIGTERM's path, which tells the room and ends at the cap.
    expect(await Effect.runPromise(test.runtime.drain)).toBe('cap')

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
    for (const event of ['room.created', 'seat.joined', 'refused', 'drain.started', 'drain.done', 'fatal'])
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

describe('SV-g: a production process', () => {
  const PLANTED_NAME = 'PlantedWren'
  const PLANTED_IP = '198.51.100.23'
  const PLANTED_BEARER = 'FAKE-BEARER-not-a-secret-0013'
  const PLANTED_SESSION = 'FAKE-SESSION-not-a-secret-0014'
  const PLANTED_PAYLOAD = 'FAKE-PAYLOAD-not-a-secret-0015'

  it('prints only schema lines to stdout and no planted value anywhere, run through runServerProcess', async () => {
    const output = spyOnOutput()
    const port = await freePort()
    const target = new EventEmitter()
    const exits: number[] = []
    const { maxRooms: _maxRooms, allowedOrigins: _allowedOrigins, ...limits } = TEST_LIMITS
    const scope = Effect.runSync(Scope.make())
    const fiber = Effect.runFork(
      runServerProcess(fixtureServer(), {
        env: {
          NODE_ENV: 'production',
          MAX_ROOMS: '4',
          ALLOWED_ORIGINS: TEST_ORIGIN,
          PORT: String(port),
        },
        net: TEST_NET,
        limits,
        process: target,
        exit: (code) => exits.push(code),
      }).pipe(Scope.extend(scope)),
    )
    await waitFor(
      () => output.stdout.some((text) => text.includes('server.started')),
      'the server never started',
    )

    // Join with a planted name and session token (the anonymous verifier accepts it), then a refused message.
    const version = await gameVersionOf(fixtureServer())
    const joinOptions = (name: string) => joinOptionsFor(name, version)
    const client = new Client(`http://127.0.0.1:${port}`)
    // A browser sends its page's origin on every matchmaking request and socket; the gates refuse any other.
    ;(client.http as unknown as { options: { headers: Record<string, string> } }).options.headers = {
      origin: TEST_ORIGIN,
    }
    const room = (await client.create(ROOM_NAME, {
      ...joinOptions(PLANTED_NAME),
      session: PLANTED_SESSION,
    })) as unknown as SdkRoom
    say(room, { t: 'cmd', seq: 0, tick: 0, type: 'not.a.command', payload: { note: PLANTED_PAYLOAD } })
    await fetch(`http://127.0.0.1:${port}/matchmake/joinById/${room.roomId}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: TEST_ORIGIN,
        authorization: `Bearer ${PLANTED_BEARER}`,
        'x-forwarded-for': PLANTED_IP,
      },
      body: JSON.stringify({ ...joinOptions(PLANTED_NAME), session: 'x y' }),
    }).then((response) => response.text())
    await room.leave(true).catch(() => undefined)

    // A crash on the process, its message carrying every planted value.
    target.emit(
      'uncaughtException',
      new TypeError(`${PLANTED_NAME} ${PLANTED_SESSION} ${PLANTED_IP} ${room.roomId}`),
    )
    expect(exits).toEqual([1])
    await Effect.runPromise(Fiber.interrupt(fiber))
    await Effect.runPromise(Scope.close(scope, Exit.void))

    const ours = output.stdout.filter((text) => text.startsWith('{"ts":'))
    expect(ours.some((text) => text.includes('"event":"fatal"'))).toBe(true)
    for (const text of ours) expect(serverLogLine.safeParse(JSON.parse(text)).success).toBe(true)
    const everything = output.all.join('\n')
    for (const secret of [
      PLANTED_NAME,
      PLANTED_IP,
      PLANTED_BEARER,
      PLANTED_SESSION,
      PLANTED_PAYLOAD,
      room.roomId,
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

  it('is not ready at its room cap, which refuses every new room, and ready again once a room closes', async () => {
    server = await startTestServer({ config: { limits: { ...TEST_LIMITS, maxRooms: 1 } } })
    const test = server
    const port = test.runtime.port
    await waitFor(() => test.runtime.readiness === 'ready', 'the server never became ready')
    const host = await test.create('Ada')
    expect(await probe(port, '/ready')).toEqual({ status: 503, body: { ready: false } })
    expect(test.runtime.readiness).toBe('full')
    expect(await probe(port, '/health')).toEqual({ status: 200, body: { ok: true } })
    const room = test.room(host.code)
    await host.leave(true)
    await waitFor(() => room.engine.info().seats.length === 0, 'the seat was never freed')
    // The harness's rooms have no clock of their own: an abandoned room closes on its next tick.
    await test.step(host.code, 1)
    await waitFor(() => test.runtime.rooms.size === 0, 'the abandoned room never closed')
    expect(await probe(port, '/ready')).toEqual({ status: 200, body: { ready: true } })
  })

  it('is not ready before its content has loaded, refusing matchmaking SERVER_UPDATING, and ready once it has', async () => {
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
      awaitVersion: false,
    })
    const test = server
    const port = test.runtime.port
    expect(await probe(port, '/ready')).toEqual({ status: 503, body: { ready: false } })
    expect(await probe(port, '/health')).toEqual({ status: 200, body: { ok: true } })
    expect(test.runtime.readiness).toBe('starting')
    expect(test.runtime.version).toBeUndefined()
    // No version yet, so no join can be checked: matchmaking is refused as a server not yet up, and opens nothing.
    const early = await test.matchmake('create', joinOptionsFor('Ada', await gameVersionOf(fixtureServer())))
    expect(early.status).toBe(503)
    expect(((await early.json()) as { error: string }).error).toMatch(/^SERVER_UPDATING: /)
    expect(test.runtime.rooms.size).toBe(0)
    expect(test.logs).toContainEqual({ event: 'refused', code: 'starting' })
    open()
    await waitFor(() => test.runtime.readiness === 'ready', 'the server never became ready')
    expect(await probe(port, '/ready')).toEqual({ status: 200, body: { ready: true } })
    expect((await test.matchmake('create', test.joinOptions('Ada'))).status).toBe(200)
  })

  it('never becomes ready when the game’s content does not load, and says so in a fatal line', async () => {
    const unreadable = {
      get goal(): number {
        throw new Error('the content is unreadable')
      },
    }
    server = await startTestServer({ def: fixtureServer({ content: unreadable }), awaitVersion: false })
    const test = server
    await waitFor(() => test.logs.some((event) => event.event === 'start.refused'), 'no start.refused line')
    expect(test.logs).toContainEqual({ event: 'start.refused', code: 'content' })
    expect(await probe(test.runtime.port, '/ready')).toEqual({ status: 503, body: { ready: false } })
    expect(await probe(test.runtime.port, '/health')).toEqual({ status: 200, body: { ok: true } })
    const refused = await test.matchmake(
      'create',
      joinOptionsFor('Ada', await gameVersionOf(fixtureServer())),
    )
    expect(refused.status).toBe(503)
    expect(test.runtime.rooms.size).toBe(0)
  })
})

describe('process safety at start', () => {
  it('refuses a test switch when the process is production, though the config’s own env says test', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    const exit = await Effect.runPromiseExit(
      Effect.scoped(
        createServerRuntime(fixtureServer(), {
          port: 0,
          limits: { ...TEST_LIMITS, allowedOrigins: ['https://game.example.test'] },
          net: TEST_NET,
          env: { NODE_ENV: 'test' },
          seed: 11,
          verifier: createFakeVerifier(),
        }),
      ),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toMatch(/seed, verifier \(fake\)/)
  })

  it('refuses to start in production while DEBUG would print Colyseus’s stacks to the console', async () => {
    const exit = await Effect.runPromiseExit(
      Effect.scoped(
        createServerRuntime(fixtureServer(), {
          port: 0,
          limits: { ...TEST_LIMITS, allowedOrigins: ['https://game.example.test'] },
          net: TEST_NET,
          env: { NODE_ENV: 'Production\r', DEBUG: 'colyseus:*' },
        }),
      ),
    )
    expect(Exit.isFailure(exit)).toBe(true)
    if (Exit.isFailure(exit)) expect(JSON.stringify(exit.cause)).toMatch(/DEBUG \(colyseus\)/)
  })

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
