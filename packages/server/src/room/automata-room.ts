/**
 * The generic room on Colyseus 0.18 (FloorFifty `race-room.ts`' Colyseus lifecycle, with its race left behind).
 *
 * An adapter and nothing more: every rule is the `RoomEngine`'s. This class turns Colyseus's lifecycle into the
 * engine's calls (create, auth, join, drop, reconnect, leave, dispose), a Colyseus client into a `RoomClient` on
 * net's two channels, and the engine's `RoomInfoView` into the small synchronized state. It drives the engine from
 * the tick scheduler on the server's clock.
 *
 * What a room needs from its server comes in a `RoomContext`, bound into the class by `roomClassFor`, so a room
 * never reaches for a global and two servers in one process (a test) never share one.
 */

import { type Client, CloseCode, Room } from '@colyseus/core'
import {
  type JoinOptions,
  joinOptionsSchema,
  NET_BYTES_CHANNEL,
  NET_CHANNEL,
  type NetConfig,
} from '@mcthaydt/automata-net'
import { createSim } from '@mcthaydt/automata-sim'
import type { Bucket, RoomLogEvent } from '../game/server-config'
import type { ServerDef } from '../game/server-game'
import { type GameVersion, versionVerdict } from '../gate/matchmake-version-gate'
import type { LiveRooms } from '../rooms/live-rooms'
import { claimRoomCode, type RandomInt, releaseRoomCode } from '../rooms/room-code'
import { RoomCommandError } from '../rooms/room-errors'
import { startTickScheduler, type TickClock, type TickScheduler } from '../rooms/tick-scheduler'
import { presenceCodeStore } from './presence-code-store'
import { type CloseReason, type RoomClient, RoomEngine } from './room-engine'
import { createRoomInfoState, projectRoomInfo, type RoomInfoState } from './room-info.schema'

/** What every room of one server shares. */
export interface RoomContext {
  readonly def: ServerDef
  readonly net: NetConfig
  readonly maxRooms: number
  readonly commandsPerSeat: Bucket
  /** A message past this is dropped before parsing (spec §4.3 `maxMessageBytes`). */
  readonly maxMessageBytes: number
  /** The protocol and hashes a join must carry (spec §4.2 join check). */
  readonly version: GameVersion
  readonly rooms: LiveRooms<AutomataRoom>
  readonly clock: TickClock
  /** Whether the server is draining: it opens no room and seats nobody new. */
  readonly isDraining: () => boolean
  /** Room codes. */
  readonly randomInt: RandomInt
  /** A fresh room seed; or the fixed test seed. */
  readonly roomSeed: () => number
  readonly env: Readonly<Record<string, string | undefined>>
  readonly log: (event: RoomLogEvent) => void
  /** A test switch: rooms start with no clock, and only the test steps them (`ServerConfig.manualClock`). */
  readonly manualClock: boolean
}

/** A refusal Colyseus hands back to the matchmaking request: the net error code first, so a client can read it. */
const refusal = (error: unknown): Error =>
  error instanceof RoomCommandError ? new Error(`${error.code}: ${error.message}`) : (error as Error)

/** A Colyseus client as the engine speaks to it: JSON text on net's channel, binary on its bytes channel. */
function roomClient(client: Client): RoomClient {
  return {
    send: (message) => client.send(NET_CHANNEL, JSON.stringify(message)),
    sendBytes: (bytes) => client.sendBytes(NET_BYTES_CHANNEL, bytes),
    close: () => client.leave(CloseCode.CONSENTED),
  }
}

/** Rooms in this process, numbered for logs: a log line names a room by this, never by its code (spec §4.5). */
let roomSerial = 0
const nextSerial = (): string => {
  roomSerial += 1
  return String(roomSerial)
}

export class AutomataRoom extends Room<{ state: RoomInfoState }> {
  /** Set by `roomClassFor`'s subclass before Colyseus calls `onCreate`. */
  protected context: RoomContext | undefined
  private roomEngine: RoomEngine | undefined
  private scheduler: TickScheduler | undefined
  private codeClaimed = false
  /** Whether the matchmaker offers this room to Quick match; undefined until the first `project`. */
  private listed: boolean | undefined
  private closing = false
  private readonly serial = nextSerial()

  /** The room's engine, for the test driver (`server/testing`); not room API. */
  get engine(): RoomEngine {
    if (this.roomEngine === undefined) throw new Error('the room has not been created')
    return this.roomEngine
  }

  private get ctx(): RoomContext {
    if (this.context === undefined) throw new Error('AutomataRoom is used through roomClassFor')
    return this.context
  }

  // ── Lifecycle ──

  override async onCreate(): Promise<void> {
    const ctx = this.ctx
    if (ctx.isDraining()) throw refusal(new RoomCommandError('SERVER_UPDATING', 'the server is updating'))
    // Only Colyseus knows whether a matchmaking request opens a room, so the cap is here; checked before a code.
    if (ctx.rooms.size >= ctx.maxRooms) {
      ctx.log({ event: 'refused', code: 'busy' })
      throw refusal(new RoomCommandError('SERVER_BUSY', 'the server is full'))
    }
    // The player-visible code is the room id, so joining by code is `joinById` and no second table maps one to the
    // other.
    this.roomId = await claimRoomCode(presenceCodeStore(this.presence), ctx.randomInt)
    this.codeClaimed = true
    ctx.rooms.register(this)

    const seed = ctx.roomSeed()
    const sim = await createSim({ seed, plugins: ctx.def.game.plugins, content: ctx.def.game.content })
    this.roomEngine = new RoomEngine({
      def: ctx.def,
      sim,
      seed,
      net: ctx.net,
      commandsPerSeat: ctx.commandsPerSeat,
      now: () => ctx.clock.now(),
      env: ctx.env,
      log: (event) => ctx.log({ ...event, room: this.serial }),
      onClose: (reason) => this.close(reason),
    })
    // A drain that began while this room was being built found no engine to tell. A room cannot close inside
    // `onCreate`, so it is refused instead: it never opens, and the drain is not left waiting on it.
    if (ctx.isDraining()) throw refusal(new RoomCommandError('SERVER_UPDATING', 'the server is updating'))
    this.maxClients = ctx.def.seats.max
    this.setState(createRoomInfoState(this.roomId))
    // No patch timer: the info state goes out from the tick, with the snapshots.
    this.setPatchRate(null)
    this.autoDispose = false
    this.onMessage(NET_CHANNEL, (client, raw: unknown) => this.receive(client, raw))
    ctx.log({ event: 'room.created', room: this.serial })

    if (ctx.manualClock) return
    const tickHz = sim.tickHz
    this.scheduler = startTickScheduler({
      tickMs: 1000 / tickHz,
      clock: ctx.clock,
      // Half a second at most: time a room drops rather than replays moves its timeline against every client's.
      maxCatchUp: Math.ceil(tickHz / 2),
      onTick: () => this.tick(),
      // `tick` keeps its own errors; this is the scheduler's promise that nothing escapes its timer.
      onError: (error) => this.fail(error),
      onCallback: (_ticks, droppedMs) => {
        if (droppedMs > 0) ctx.log({ event: 'tick.slow', room: this.serial, ms: droppedMs })
      },
    })
  }

  /** Validated before a seat exists: a bad join is refused, not seated and then removed. Reconnects skip this. */
  override onAuth(_client: Client, options: unknown): true {
    const parsed = joinOptionsSchema.safeParse(options)
    if (!parsed.success) throw new Error('REFUSED: the join options are not valid')
    // The matchmaking gate refused other versions already; the room holds the same line for any join that reaches it.
    if (versionVerdict(parsed.data, this.ctx.version) !== 'same')
      throw new Error('VERSION_MISMATCH: this game is out of date: reload to play')
    try {
      if (this.ctx.isDraining()) throw new RoomCommandError('SERVER_UPDATING', 'the server is updating')
      this.engine.admit()
    } catch (error) {
      throw refusal(error)
    }
    return true
  }

  override onJoin(client: Client, options: unknown): void {
    const { name } = joinOptionsSchema.parse(options) as JoinOptions
    let seat: number
    try {
      seat = this.engine.join(client.sessionId, name, roomClient(client))
    } catch (error) {
      // A join reserved before the room filled or started reaches here after the seat went.
      throw refusal(error)
    }
    this.project()
    this.ctx.log({ event: 'seat.joined', room: this.serial, seat })
  }

  /**
   * A connection lost rather than given up: the seat is held for the grace, on room ticks in the engine and in wall
   * seconds by Colyseus, whose reconnection token is cancelled when the engine gives the seat up first.
   */
  override onDrop(client: Client): void {
    const engine = this.engine
    if (this.closing) {
      engine.leave(client.sessionId)
      return
    }
    engine.drop(client.sessionId)
    const reconnection = this.allowReconnection(client, engine.graceSeconds)
    engine.hold(client.sessionId, () => reconnection.reject(false))
    void Promise.resolve(reconnection).then(
      () => engine.endHold(client.sessionId),
      () => engine.endHold(client.sessionId),
    )
    this.project()
  }

  override onReconnect(client: Client): void {
    this.engine.reconnect(client.sessionId, roomClient(client))
    this.project()
  }

  /** A consented leave, or a drop the grace ran out on: the seat is freed for good. Idempotent. */
  override onLeave(client: Client): void {
    const seat = this.roomEngine?.seatOf(client.sessionId)
    this.roomEngine?.leave(client.sessionId)
    if (seat !== undefined) this.ctx.log({ event: 'seat.left', room: this.serial, seat })
    if (this.roomEngine !== undefined) this.project()
  }

  override onDispose(): void {
    const ctx = this.ctx
    ctx.rooms.forget(this)
    this.stopClock()
    // A room refused at the cap, or that failed partway through onCreate, built none of this and claimed no code.
    this.roomEngine?.dispose()
    if (this.codeClaimed) void releaseRoomCode(presenceCodeStore(this.presence), this.roomId)
    ctx.log({ event: 'room.disposed', room: this.serial })
  }

  // ── The tick ──

  /** One tick: the engine's, then the info state; a patch goes with each snapshot. */
  tick(): void {
    if (this.closing) return
    try {
      const engine = this.engine
      engine.step()
      this.project()
      if (engine.tick % this.ctx.net.snapshotEvery === 0) this.broadcastPatch()
    } catch (error) {
      this.fail(error)
    }
  }

  /**
   * Something on the tick threw outside the engine's own boundary (which halts the room for the game's code). The
   * room halts the same way: logged by the error's class, closed with an error, and the process carries on.
   */
  private fail(error: unknown): void {
    this.ctx.log({
      event: 'room.error',
      room: this.serial,
      code: error instanceof Error ? error.name : typeof error,
    })
    this.close('failed')
  }

  /** Stops the room's own clock for good: a test that steps the room by hand calls this first. */
  stopClock(): void {
    this.scheduler?.stop()
    this.scheduler = undefined
  }

  /** The server is draining (`LiveRooms`): the engine decides what that means for this room. */
  beginDrain(): void {
    this.roomEngine?.beginDrain()
    if (this.roomEngine !== undefined && !this.closing) this.project()
  }

  // ── Messages ──

  /**
   * Every client message, inside an error boundary (FloorFifty audit A01): Colyseus calls a handler outside any
   * try/catch of its own, so an error a handler let escape would reach the process and end every game on it.
   */
  private receive(client: Client, raw: unknown): void {
    // The size cap comes before anything reads the message (spec §6): dropped, counted, and the socket stays.
    if (typeof raw === 'string' && Buffer.byteLength(raw, 'utf8') > this.ctx.maxMessageBytes) {
      const seat = this.roomEngine?.seatOf(client.sessionId)
      this.ctx.log({
        event: 'refused',
        room: this.serial,
        ...(seat === undefined ? {} : { seat }),
        code: 'size',
      })
      return
    }
    try {
      this.engine.receive(client.sessionId, raw)
      this.project()
    } catch {
      this.ctx.log({ event: 'refused', room: this.serial, code: 'error' })
    }
  }

  private project(): void {
    const engine = this.engine
    projectRoomInfo(this.state, engine.info())
    this.syncListing(!engine.draining && engine.lobby.phase === 'lobby')
  }

  /**
   * The room is offered to Quick match (`joinOrCreate`) exactly while it is in its lobby and not draining
   * (FloorFifty's listing). Colyseus's `private` means "not offered"; its lock keeps meaning "full", and a friend
   * with the code (`joinById`) is told the real reason by `onAuth`. A no-op while the answer has not changed.
   */
  private syncListing(listed: boolean): void {
    if (listed === this.listed || this.closing) return
    this.listed = listed
    void this.setPrivate(!listed).catch(() => undefined)
  }

  /**
   * The engine has nothing left to do. A drained room closes with Colyseus's server-shutdown code, which a client
   * reads as `SERVER_UPDATING`; an abandoned one simply goes.
   */
  private close(reason: CloseReason): void {
    if (this.closing) return
    this.closing = true
    this.stopClock()
    if (reason === 'drained') this.ctx.log({ event: 'drain.room', room: this.serial })
    const code =
      reason === 'drained'
        ? CloseCode.SERVER_SHUTDOWN
        : reason === 'failed'
          ? CloseCode.WITH_ERROR
          : CloseCode.CONSENTED
    void this.disconnect(code)
  }
}

/** The room class one server defines: `AutomataRoom` with this server's context bound in. */
export function roomClassFor(context: RoomContext): typeof AutomataRoom {
  return class BoundRoom extends AutomataRoom {
    protected override context: RoomContext | undefined = context
  }
}
