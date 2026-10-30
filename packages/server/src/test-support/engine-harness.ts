/**
 * A room engine on the fixture game, with fake clients and a fake clock: every rule the room applies, tested without
 * Colyseus or sockets.
 */

import {
  type ClientMessage,
  type NetConfig,
  parseServerMessage,
  type ServerMessage,
} from '@mcthaydt/automata-net'
import type { Sim } from '@mcthaydt/automata-sim'
import type { ReplayCompression } from '@mcthaydt/automata-sim/replay'
import type { Bucket, RoomLogEvent } from '../game/server-config'
import type { ServerDef } from '../game/server-game'
import { type RoomClient, RoomEngine } from '../room/room-engine'
import { fixtureServer, fixtureSim } from './fixture-game'

export interface FakeClient extends RoomClient {
  readonly session: string
  /** Every wire message received, parsed, in order; bytes are recorded as `{ bytes }`. */
  readonly inbox: ({ readonly message: ServerMessage } | { readonly bytes: Uint8Array })[]
  closed: boolean
  of<T extends ServerMessage['t']>(type: T): Extract<ServerMessage, { t: T }>[]
}

export interface EngineHarness {
  readonly engine: RoomEngine
  readonly sim: Sim
  readonly logs: RoomLogEvent[]
  readonly closes: string[]
  now: number
  join(name: string): FakeClient
  client(session: string): FakeClient
  send(client: FakeClient, message: ClientMessage | Record<string, unknown>): void
  steps(count: number): void
  /** Readies every listed client, then steps until play starts. */
  startPlay(...clients: FakeClient[]): void
  dispose(): void
}

export const TEST_NET: NetConfig = {
  url: 'ws://localhost:1',
  snapshotEvery: 3,
  maxLeadTicks: 60,
  interpolationTicks: 6,
  reconnectGraceSeconds: 1,
}

let sessions = 0
const nextSession = (): string => {
  sessions += 1
  return `s${sessions}`
}

export function fakeClient(session: string = nextSession()): FakeClient {
  const inbox: FakeClient['inbox'][number][] = []
  const client: FakeClient = {
    session,
    inbox,
    closed: false,
    send(message) {
      // Through the wire's own schema, as a client reads it: a room that sent a malformed message fails here.
      const parsed = parseServerMessage(JSON.stringify(message))
      if (!parsed.ok) throw new Error(`the room sent a malformed message: ${parsed.detail}`)
      inbox.push({ message: parsed.message })
    },
    sendBytes(bytes) {
      inbox.push({ bytes })
    },
    close() {
      client.closed = true
    },
    of(type) {
      return inbox.flatMap((entry) =>
        'message' in entry && entry.message.t === type
          ? [entry.message as Extract<ServerMessage, { t: typeof type }>]
          : [],
      )
    },
  }
  return client
}

export async function engineHarness(
  options: {
    def?: ServerDef
    seed?: number
    env?: Record<string, string | undefined>
    net?: Partial<NetConfig>
    commandsPerSeat?: Bucket
    compression?: ReplayCompression
  } = {},
): Promise<EngineHarness> {
  const sim = await fixtureSim(options.seed ?? 7)
  const logs: RoomLogEvent[] = []
  const closes: string[] = []
  const clients = new Map<string, FakeClient>()
  const harness: EngineHarness = {
    sim,
    logs,
    closes,
    now: 0,
    engine: new RoomEngine({
      def: options.def ?? fixtureServer(),
      sim,
      seed: options.seed ?? 7,
      net: { ...TEST_NET, ...options.net },
      commandsPerSeat: options.commandsPerSeat ?? { burst: 60, perSecond: 120 },
      now: () => harness.now,
      env: options.env ?? { NODE_ENV: 'test' },
      log: (event) => logs.push(event),
      onClose: (reason) => closes.push(reason),
      compression: options.compression,
    }),
    join(name) {
      const client = fakeClient()
      clients.set(client.session, client)
      harness.engine.join(client.session, name, client)
      return client
    },
    client(session) {
      const client = clients.get(session)
      if (client === undefined) throw new Error(`no client ${session}`)
      return client
    },
    send(client, message) {
      harness.engine.receive(client.session, JSON.stringify(message))
    },
    steps(count) {
      for (let index = 0; index < count; index += 1) {
        harness.engine.step()
        harness.now += 1000 / sim.tickHz
      }
    },
    startPlay(...players) {
      for (const [index, client] of players.entries())
        harness.send(client, { t: 'ready', ready: true, req: `start-${index}` })
      for (let guard = 0; guard < 600 && harness.engine.lobby.phase !== 'playing'; guard += 1)
        harness.steps(1)
      if (harness.engine.lobby.phase !== 'playing') throw new Error('play never started')
    },
    dispose() {
      harness.engine.dispose()
    },
  }
  return harness
}
