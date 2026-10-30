/**
 * The Colyseus integration harness (FloorFifty `tests/server/support/colyseus-harness.ts`, generic).
 *
 * Real rooms and real clients over real sockets: the server is `createServerRuntime` on an ephemeral port (0, never
 * a fixed one), wrapped in `@colyseus/testing`'s `ColyseusTestServer` for its SDK client. Only the room's clock is
 * taken over: a test stops it and steps the room by hand, so a grace or a countdown is tested in ticks, and no
 * assertion depends on timer scheduling. Waiting on the network is on what arrived, never on a sleep.
 */

import { ColyseusTestServer } from '@colyseus/testing'
import {
  type ClientMessage,
  NET_BYTES_CHANNEL,
  NET_CHANNEL,
  PROTOCOL_VERSION,
  parseServerMessage,
  ROOM_NAME,
  type ServerMessage,
} from '@mcthaydt/automata-net'
import { Effect, Exit, Scope } from 'effect'
import type { RoomLogEvent, ServerConfig, ServerLimits } from '../game/server-config'
import type { ServerDef } from '../game/server-game'
import type { AutomataRoom } from '../room/automata-room'
import { createServerRuntime, type ServerRuntime } from '../server/start-server'
import { TEST_NET } from './engine-harness'
import { fixtureServer } from './fixture-game'

export const TEST_LIMITS: ServerLimits = {
  maxRooms: 4,
  allowedOrigins: [],
  maxMessageBytes: 16_384,
  socketsPerIp: 16,
  perIp: {
    create: { burst: 10, perSecond: 1 },
    join: { burst: 10, perSecond: 1 },
    reconnect: { burst: 10, perSecond: 1 },
  },
  commandsPerSeat: { burst: 60, perSecond: 120 },
}

export const HASH = '0123456789abcdef'

export const joinOptions = (name: string): Record<string, unknown> => ({
  protocol: PROTOCOL_VERSION,
  schemaHash: HASH,
  contentHash: HASH,
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
  options: { readonly def?: ServerDef; readonly config?: Partial<ServerConfig> } = {},
): Promise<TestServer> {
  const logs: RoomLogEvent[] = []
  const scope = Effect.runSync(Scope.make())
  const runtime = await Effect.runPromise(
    createServerRuntime(options.def ?? fixtureServer(), {
      port: 0,
      limits: TEST_LIMITS,
      net: TEST_NET,
      seed: 11,
      env: { NODE_ENV: 'test' },
      log: (event) => logs.push(event),
      ...options.config,
    }).pipe(Scope.extend(scope)),
  )
  const colyseus = new ColyseusTestServer(runtime.gameServer)
  const room = (code: string): AutomataRoom => {
    const found = colyseus.getRoomById(code) as unknown as AutomataRoom | undefined
    if (found === undefined) throw new Error(`no room ${code}`)
    found.stopClock()
    return found
  }
  const seated = async (client: TestClient): Promise<TestClient> => {
    // The room tells a client its seat on the next tick (one path, spec §4.3 Seats).
    await server.step(client.code, 1)
    await waitFor(() => client.of('seated').length > 0, 'the room never told the client its seat')
    return client
  }
  const server: TestServer = {
    runtime,
    colyseus,
    logs,
    async create(name) {
      const sdkRoom = (await colyseus.sdk.create(ROOM_NAME, joinOptions(name))) as unknown as SdkRoom
      room(sdkRoom.roomId)
      return seated(wrap(sdkRoom))
    },
    async joinById(code, name) {
      const sdkRoom = (await colyseus.sdk.joinById(code, joinOptions(name))) as unknown as SdkRoom
      return seated(wrap(sdkRoom))
    },
    async quickMatch(name) {
      const sdkRoom = (await colyseus.sdk.joinOrCreate(ROOM_NAME, joinOptions(name))) as unknown as SdkRoom
      room(sdkRoom.roomId)
      return seated(wrap(sdkRoom))
    },
    async reconnect(token) {
      const sdkRoom = (await colyseus.sdk.reconnect(token)) as unknown as SdkRoom
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
