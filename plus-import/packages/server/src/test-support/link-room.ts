/**
 * A room engine and its players over seeded links, on `TestClock` (M7 spec §12 "deterministic network"; the model
 * FloorFifty's `tests/client/support/model-room.ts` built for its race, here for any sim).
 *
 * Each player is a real client: net's transport and port over a link (`linkClient`), a `NetSession` stepping its own
 * copy of the fixture game. The room is the real `RoomEngine`, its clients the room ends of the links. Time moves
 * only by the driver: the room steps at 60 Hz, each player draws a 60 Hz frame just after it, and every message
 * arrives when its link says. So a run replays exactly, and a failure replays with it.
 *
 * The harness records what the tests measure: the room's hash at each snapshot tick and each seat's position after
 * each tick it steps, each player's first prediction of its own position on each tick, every snapshot each player
 * restored, and whether each command took effect in the player's sim on the tick it was sampled for.
 */

import { type LocalCommand, type NetConfig, NetSession } from '@mcthaydt/automata-net'
import {
  createLink,
  type LinkClient,
  type LinkOptions,
  type LinkRoomClient,
  linkClient,
  linkRoomClient,
} from '@mcthaydt/automata-net/testing'
import { type Command, createSim, type Sim } from '@mcthaydt/automata-sim'
import { Clock, type Effect, ManagedRuntime, TestClock, TestContext } from 'effect'
import type { RoomLogEvent } from '../game/server-config'
import { RoomEngine } from '../room/room-engine'
import { acceptsInput } from '../rooms/lobby-rules'
import { fixtureGame, fixtureServer, positions } from './fixture-game'

/** The fixture game with a goal nobody reaches, so a game runs as long as a test wants. */
const ENDLESS = { goal: 1_000_000_000 }
const TICK_MS = 1000 / 60

const NET: NetConfig = {
  url: 'ws://localhost:1',
  snapshotEvery: 3,
  maxLeadTicks: 60,
  interpolationTicks: 6,
  reconnectGraceSeconds: 30,
  degradedRoundTripMs: 1000,
  degradedGapMs: 1000,
}

export interface LinkRoomOptions {
  /** Both directions of every player's link; each player's seed is derived from `seed`. */
  readonly link: Omit<LinkOptions, 'seed'>
  readonly seed?: number
  readonly players?: number
  /**
   * The round trip each session starts from, as `NetRoom`'s probes measure it before play: by default the link's
   * (twice its latency); `null` for none measured.
   */
  readonly roundTripMs?: number | null
  /** Player `index`'s commands for `tick`, its `frame`-th sample. */
  readonly sample?: (index: number, tick: number, frame: number) => readonly LocalCommand[]
}

export interface LinkPlayer {
  readonly index: number
  readonly session: string
  readonly sim: Sim
  readonly net: NetSession
  readonly client: LinkClient
  /** Every command the session sampled and sent (resends not repeated). */
  readonly sent: Command[]
  /** The player's own position on each tick, as first predicted. */
  readonly predicted: Map<number, number>
  /** Every snapshot restored, in order. */
  readonly restored: { readonly tick: number; readonly hash: string }[]
  /** Commands that did not take effect in the player's sim on the tick they were sampled for. */
  readonly offTick: Command[]
  /** The room's ack for this player's seat in the last snapshot restored: the last seq it took. */
  lastAck: number | undefined
  /** Snapshot ticks whose bytes the room's end of this link changes on the way. */
  readonly corrupt: Set<number>
  /** Snapshot ticks that failed their hash and were not restored. */
  readonly refused: number[]
  connected: boolean
}

export interface LinkRoom {
  readonly engine: RoomEngine
  readonly players: readonly LinkPlayer[]
  /** The room's hash at each tick it published a snapshot at. */
  readonly hashes: Map<number, string>
  /** Each seat's position after each tick the room stepped. */
  readonly positions: Map<number, Record<number, number>>
  readonly logs: RoomLogEvent[]
  now(): number
  /** Readies everyone and runs until play has started. */
  start(): Promise<void>
  runFor(ms: number): Promise<void>
  /** The player's connection drops: nothing crosses either way, and the room holds the seat. */
  drop(player: LinkPlayer): void
  /** The player's connection returns on a fresh link, into the same seat. */
  reconnect(player: LinkPlayer): void
  dispose(): Promise<void>
}

const seatOf = (player: LinkPlayer): number | undefined => player.client.seat()
const ownX = (player: LinkPlayer): number => {
  const seat = seatOf(player)
  return seat === undefined ? 0 : (positions(player.sim)[seat] ?? 0)
}

/** A copy of `bytes` with its last byte changed. */
const changed = (bytes: Uint8Array): Uint8Array => {
  const copy = new Uint8Array(bytes)
  copy[copy.length - 1] = (copy[copy.length - 1] as number) ^ 0xff
  return copy
}

export async function linkRoom(options: LinkRoomOptions): Promise<LinkRoom> {
  const seed = options.seed ?? 11
  const count = options.players ?? 2
  const runtime = ManagedRuntime.make(TestContext.TestContext)
  const run = (effect: Effect.Effect<void>): void => runtime.runSync(effect)
  const now = (): number => runtime.runSync(Clock.currentTimeMillis)
  const roomSim = await createSim({ seed, plugins: fixtureGame.plugins, content: ENDLESS })
  const logs: RoomLogEvent[] = []
  const engine = new RoomEngine({
    def: fixtureServer({ content: ENDLESS, seats: { min: count, max: Math.max(2, count) } }),
    sim: roomSim,
    seed,
    net: NET,
    commandsPerSeat: { burst: 60, perSecond: 120 },
    now,
    env: { NODE_ENV: 'test' },
    log: (event) => logs.push(event),
    onClose: () => undefined,
  })
  const hashes = new Map<number, string>()
  const seatPositions = new Map<number, Record<number, number>>()
  let linkSerial = 0

  const roomEnd = (player: LinkPlayer, transport: Parameters<typeof linkRoomClient>[0]): LinkRoomClient => {
    const end = linkRoomClient(transport, run)
    let headerTick: number | undefined
    return {
      send(message) {
        headerTick = message.t === 'snap' ? message.tick : undefined
        end.send(message)
      },
      sendBytes(bytes) {
        end.sendBytes(headerTick !== undefined && player.corrupt.has(headerTick) ? changed(bytes) : bytes)
      },
      close: () => end.close(),
      get closed() {
        return end.closed
      },
    }
  }
  /** A fresh link for `player`: what arrives at the room's end goes to the engine as that session's messages. */
  const connect = (player: Pick<LinkPlayer, 'session'>) => {
    linkSerial += 1
    const link = createLink({ ...options.link, seed: seed * 64 + linkSerial })
    const off = link.server.onMessage((data) => engine.receive(player.session, data))
    return { link, off }
  }
  /** Each player's current link, so a drop can cut what arrives from it. */
  const offs = new Map<string, () => void>()

  const players: LinkPlayer[] = []
  for (let index = 0; index < count; index += 1) {
    const sim = await createSim({ seed, plugins: fixtureGame.plugins, content: ENDLESS })
    const { link, off } = connect({ session: `p${index}` })
    offs.set(`p${index}`, off)
    const client = linkClient(link.client, { run, now })
    const roundTripMs =
      options.roundTripMs === null ? undefined : (options.roundTripMs ?? options.link.latencyMs * 2)
    const player: LinkPlayer = {
      index,
      session: `p${index}`,
      sim,
      client,
      net: new NetSession({
        sim,
        send: (command) => {
          client.port.sendCommand(command)
          if (!player.sent.some((sent) => sent.seq === command.seq)) player.sent.push(command)
        },
        ping: (tick) => client.port.ping(tick),
        roundTripMs,
        maxLeadTicks: NET.maxLeadTicks,
        now,
      }),
      sent: [],
      predicted: new Map(),
      restored: [],
      offTick: [],
      corrupt: new Set(),
      refused: [],
      lastAck: undefined,
      connected: true,
    }
    client.port.onSnapshot((snapshot) => {
      const before = player.net.authoritative
      const mismatches = player.net.mismatches
      player.net.observe(snapshot, now())
      const after = player.net.authoritative
      if (player.net.mismatches > mismatches) player.refused.push(snapshot.tick)
      // By tick: a stale or repeated frame leaves the last restore in place, and is not a restore.
      else if (after !== undefined && after.tick !== before?.tick) {
        player.restored.push(after)
        const seat = seatOf(player)
        if (seat !== undefined) player.lastAck = snapshot.acks[String(seat)] ?? player.lastAck
      }
    })
    client.port.onPong((pong) => player.net.pong(pong))
    engine.join(player.session, `P${index}`, roomEnd(player, link.server))
    players.push(player)
  }

  let serverTicks = 0
  const frames = players.map(() => 0)
  const lastFrameAt = players.map(() => 0)
  const serverAt = (tick: number): number => Math.round(tick * TICK_MS)
  // Players draw at 60 Hz on the room's own instants, after it steps: one clock move per tick instead of one per
  // event, which halves a run's time (a phase per player cost 5 s of wall time per 5 s of play on the shared Mac).
  const frameAt = (frame: number): number => Math.round(frame * TICK_MS)

  const stepRoom = (): void => {
    engine.step()
    const stepped = engine.tick - 1
    seatPositions.set(stepped, positions(engine.sim))
    if (engine.tick % NET.snapshotEvery === 0) hashes.set(engine.tick, engine.sim.hash())
  }

  const drawFrame = (player: LinkPlayer, at: number): void => {
    const delta = at - (lastFrameAt[player.index] as number)
    lastFrameAt[player.index] = at
    const frame = frames[player.index] as number
    frames[player.index] = frame + 1
    const seat = seatOf(player)
    player.net.setRoomState({
      seat,
      accepting: player.connected && seat !== undefined && acceptsInput(engine.lobby),
    })
    const before = player.net.sampledTick
    let sampled: { readonly tick: number; readonly simTick: number; readonly x: number } | undefined
    const sentBefore = player.sent.length
    player.net.frame((tick) => {
      sampled = { tick, simTick: player.sim.tick, x: ownX(player) }
      return options.sample?.(player.index, tick, frame) ?? []
    }, delta)
    if (sampled === undefined || player.net.sampledTick === before) return
    if (!player.predicted.has(sampled.tick)) player.predicted.set(sampled.tick, ownX(player))
    const fresh = player.sent.slice(sentBefore)
    const moved = fresh.reduce((sum, command) => sum + (command.payload as { dx: number }).dx, 0)
    const onTick =
      sampled.simTick === sampled.tick &&
      player.sim.tick === sampled.tick + 1 &&
      ownX(player) === sampled.x + moved &&
      fresh.every((command) => command.tick === sampled?.tick)
    if (!onTick) player.offTick.push(...fresh)
  }

  const runFor = async (ms: number): Promise<void> => {
    const end = now() + ms
    for (;;) {
      const nextServer = serverAt(serverTicks)
      let next = nextServer
      for (const player of players) next = Math.min(next, frameAt(frames[player.index] as number))
      if (next > end) break
      const wait = next - now()
      if (wait > 0) await runtime.runPromise(TestClock.adjust(wait))
      if (nextServer === next) {
        stepRoom()
        serverTicks += 1
      }
      for (const player of players)
        if (frameAt(frames[player.index] as number) === next) drawFrame(player, next)
    }
    const rest = end - now()
    if (rest > 0) await runtime.runPromise(TestClock.adjust(rest))
  }

  return {
    engine,
    players,
    hashes,
    positions: seatPositions,
    logs,
    now,
    async start() {
      for (const [index, player] of players.entries())
        engine.receive(player.session, JSON.stringify({ t: 'ready', ready: true, req: `ready-${index}` }))
      for (let guard = 0; guard < 100 && engine.lobby.phase !== 'playing'; guard += 1) await runFor(50)
      if (engine.lobby.phase !== 'playing') throw new Error('play never started')
    },
    runFor,
    drop(player) {
      player.connected = false
      player.client.detach()
      offs.get(player.session)?.()
      engine.drop(player.session)
    },
    reconnect(player) {
      const { link, off } = connect(player)
      offs.set(player.session, off)
      engine.reconnect(player.session, roomEnd(player, link.server))
      player.client.attach(link.client)
      player.connected = true
      player.net.resync()
    },
    async dispose() {
      engine.dispose()
      for (const player of players) player.sim.dispose()
      await runtime.dispose()
    },
  }
}
