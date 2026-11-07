/**
 * The Colyseus integration harness.
 *
 * Real rooms and real clients over real sockets: the server is `createServerRuntime` on an ephemeral port (0, never
 * a fixed one), wrapped in `@colyseus/testing`'s `ColyseusTestServer` for its SDK client. Only the room's clock is
 * taken over: a test stops it and steps the room by hand, so a grace or a countdown is tested in ticks, and no
 * assertion depends on timer scheduling. Waiting on the network is on what arrived, never on a sleep.
 */

import {
  type ClientMessage,
  NET_BYTES_CHANNEL,
  NET_CHANNEL,
  parseServerMessage,
  ROOM_NAME,
  type ServerMessage,
} from '@automata/net'
import { ColyseusTestServer } from '@colyseus/testing'
import { Effect, Exit, Scope } from 'effect'
import { createServerRuntime, type ServerRuntime } from '../app/start-server'
import type { AutomataRoom } from '../features/room/engine/automata-room'
import type { RoomLogEvent, ServerConfig, ServerLimits } from '../shared/game/server-config'
import type { ServerDef } from '../shared/game/server-game'
import type { GameVersion } from '../shared/game-version'
import { TEST_NET } from './engine-harness'
import { fixtureServer } from './fixture-game'

/** The page every test client says it comes from: the one origin `TEST_LIMITS` lists. */
export const TEST_ORIGIN = 'https://game.test'

export const TEST_LIMITS: ServerLimits = {
  maxRooms: 4,
  allowedOrigins: [TEST_ORIGIN],
  maxMessageBytes: 16_384,
  socketsPerIp: 16,
  perIp: {
    create: { burst: 10, perSecond: 1 },
    join: { burst: 10, perSecond: 1 },
    quickMatch: { burst: 10, perSecond: 1 },
    reconnect: { burst: 10, perSecond: 1 },
  },
  commandsPerSeat: { burst: 60, perSecond: 120 },
}

/** Join options for the game whose `version` the server reports. */
export const joinOptions = (name: string, version: GameVersion): Record<string, unknown> => ({
  protocol: version.protocol,
  schemaHash: version.schemaHash,
  contentHash: version.contentHash,
  name,
})

/** Waits for something the server does on its own schedule, or fails saying what never happened. */
export async function waitFor(condition: () => boolean, failure: string, timeoutMs = 5_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!condition()) {
    if (Date.now() > deadline) throw new Error(failure)
    await new Promise((resolve) => setTimeout(resolve, 2))
  }
}

/** The slice of the SDK room the tests use. */
interface SdkRoom {
  readonly roomId: string
  readonly sessionId: string
  readonly reconnectionToken: string
  readonly reconnection: { enabled: boolean }
  readonly state: unknown
  onMessage(type: string, handler: (payload: unknown) => void): unknown
  onLeave(handler: (code: number) => void): unknown
  send(type: string, payload: unknown): void
  leave(consented?: boolean): Promise<number>
}

export interface TestClient {
  readonly code: string
  readonly sessionId: string
  readonly reconnectionToken: string
  /** The room-info state as this client holds it, as JSON. */
  info(): { code: string; phase: string; hostSeat: number; seats: Record<string, unknown>[] }
  /** Every wire message and binary received, in arrival order. */
  readonly inbox: ({ readonly message: ServerMessage } | { readonly bytes: Uint8Array })[]
  of<T extends ServerMessage['t']>(type: T): Extract<ServerMessage, { t: T }>[]
  /** The close code, once the connection has closed. */
  readonly closedWith: number | undefined
  send(message: ClientMessage | Record<string, unknown>): void
  leave(consented: boolean): Promise<void>
}

export interface TestServer {
  readonly runtime: ServerRuntime
  readonly colyseus: ColyseusTestServer
  readonly logs: RoomLogEvent[]
  readonly base: string
  /** Join options carrying this server's version. */
  joinOptions(name: string): Record<string, unknown>
  /**
   * A raw matchmaking request, as a browser on `origin` sends it (`null`: no Origin header), to
   * `/matchmake/<call>/<target>`; the target is the room name unless given.
   */
  matchmake(call: string, body: unknown, target?: string, origin?: string | null): Promise<Response>
  create(name: string): Promise<TestClient>
  joinById(code: string, name: string): Promise<TestClient>
  /** `joinOrCreate`, as Quick match does. */
  quickMatch(name: string): Promise<TestClient>
  reconnect(token: string): Promise<TestClient>
  /** The live room, with its own clock stopped so only the test steps it. */
  room(code: string): AutomataRoom
  /** Steps the room `count` ticks, after letting messages in flight reach it. */
  step(code: string, count: number): Promise<void>
  close(): Promise<void>
}

/** Lets pending socket reads run, so a message a client sent reaches the room before the next tick. */
export const settle = async (): Promise<void> => {
  for (let round = 0; round < 2; round += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setImmediate(resolve))
  }
}

function wrap(sdkRoom: SdkRoom): TestClient {
  // The SDK would otherwise retry a dropped socket by itself, undoing a drop a test asked for.
  sdkRoom.reconnection.enabled = false
  const inbox: TestClient['inbox'][number][] = []
  let closedWith: number | undefined
  sdkRoom.onLeave((code) => {
    closedWith = code
  })
  sdkRoom.onMessage(NET_CHANNEL, (payload) => {
    const parsed = parseServerMessage(payload as string)
    if (!parsed.ok) throw new Error(`the room sent a malformed message: ${parsed.detail}`)
    inbox.push({ message: parsed.message })
  })
  sdkRoom.onMessage(NET_BYTES_CHANNEL, (payload) => {
    inbox.push({ bytes: new Uint8Array(payload as Uint8Array) })
  })
  return {
    code: sdkRoom.roomId,
    sessionId: sdkRoom.sessionId,
    reconnectionToken: sdkRoom.reconnectionToken,
    info: () => (sdkRoom.state as { toJSON(): ReturnType<TestClient['info']> }).toJSON(),
    inbox,
    of(type) {
      return inbox.flatMap((entry) =>
        'message' in entry && entry.message.t === type
          ? [entry.message as Extract<ServerMessage, { t: typeof type }>]
          : [],
      )
    },
    get closedWith() {
      return closedWith
    },
    send: (message) => sdkRoom.send(NET_CHANNEL, JSON.stringify(message)),
    async leave(consented) {
      await sdkRoom.leave(consented).catch(() => undefined)
    },
  }
}

export async function startTestServer(
  options: {
    readonly def?: ServerDef
    readonly config?: Partial<ServerConfig>
    /**
     * Whether to wait for the server to read its game's version, as every test that joins needs [true]. A test of
     * the server before its content loads sets it false.
     */
    readonly awaitVersion?: boolean
  } = {},
): Promise<TestServer> {
  const logs: RoomLogEvent[] = []
  const scope = Effect.runSync(Scope.make())
  const runtime = await Effect.runPromise(
    createServerRuntime(options.def ?? fixtureServer(), {
      port: 0,
      // Issue #14: never Node's wildcard, which on macOS can share its port with another process's loopback listener.
      host: '127.0.0.1',
      limits: TEST_LIMITS,
      net: TEST_NET,
      seed: 11,
      env: { NODE_ENV: 'test' },
      manualClock: true,
      log: (event) => logs.push(event),
      ...options.config,
    }).pipe(Scope.extend(scope)),
  )
  const colyseus = new ColyseusTestServer(runtime.gameServer)
  // A browser sends its page's origin on every matchmaking request and socket; the gates refuse any other.
  ;(colyseus.sdk.http as unknown as { options: { headers: Record<string, string> } }).options.headers = {
    origin: TEST_ORIGIN,
  }
  const base = `http://127.0.0.1:${runtime.port}`
  if (options.awaitVersion !== false)
    await waitFor(
      () => runtime.version !== undefined || logs.some((event) => event.event === 'start.refused'),
      'the server never read its version',
    )
  const optionsFor = (name: string): Record<string, unknown> => {
    if (runtime.version === undefined) throw new Error('the server has not read its version yet')
    return joinOptions(name, runtime.version)
  }
  const room = (code: string): AutomataRoom => {
    const found = colyseus.getRoomById(code) as unknown as AutomataRoom | undefined
    if (found === undefined) throw new Error(`no room ${code}`)
    found.stopClock()
    return found
  }
  const seated = async (client: TestClient): Promise<TestClient> => {
    // The room tells a client its seat on the next tick.
    await server.step(client.code, 1)
    await waitFor(() => client.of('seated').length > 0, 'the room never told the client its seat')
    return client
  }
  // Issue #14: the SDK's error read "MatchMakeError: [object Object]" with a code of 401. This names the call, the
  // code and the message, serialized when it is not a string, so a failure says what answered.
  const matchmade = async <T>(call: string, request: Promise<T>): Promise<T> => {
    try {
      return await request
    } catch (error) {
      const { code, message } = error as { code?: unknown; message?: unknown }
      throw new Error(`matchmake ${call} failed: code ${String(code)}, message ${JSON.stringify(message)}`, {
        cause: error,
      })
    }
  }
  const server: TestServer = {
    runtime,
    colyseus,
    logs,
    base,
    joinOptions: optionsFor,
    matchmake(call, body, target = ROOM_NAME, origin = TEST_ORIGIN) {
      return fetch(`${base}/matchmake/${call}/${target}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...(origin === null ? {} : { origin }) },
        body: typeof body === 'string' ? body : JSON.stringify(body),
      })
    },
    async create(name) {
      const sdkRoom = (await matchmade(
        'create',
        colyseus.sdk.create(ROOM_NAME, optionsFor(name)),
      )) as unknown as SdkRoom
      room(sdkRoom.roomId)
      return seated(wrap(sdkRoom))
    },
    async joinById(code, name) {
      const sdkRoom = (await matchmade(
        'joinById',
        colyseus.sdk.joinById(code, optionsFor(name)),
      )) as unknown as SdkRoom
      return seated(wrap(sdkRoom))
    },
    async quickMatch(name) {
      const sdkRoom = (await matchmade(
        'joinOrCreate',
        colyseus.sdk.joinOrCreate(ROOM_NAME, optionsFor(name)),
      )) as unknown as SdkRoom
      room(sdkRoom.roomId)
      return seated(wrap(sdkRoom))
    },
    async reconnect(token) {
      const sdkRoom = (await matchmade('reconnect', colyseus.sdk.reconnect(token))) as unknown as SdkRoom
      return seated(wrap(sdkRoom))
    },
    room,
    async step(code, count) {
      await settle()
      const target = room(code)
      for (let tick = 0; tick < count; tick += 1) target.tick()
      await settle()
    },
    async close() {
      await Effect.runPromise(Scope.close(scope, Exit.void))
    },
  }
  return server
}
