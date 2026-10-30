/**
 * One room, without Colyseus (FloorFifty `race-room.ts`' lifecycle and tick, with the race left behind).
 *
 * The room owns the clock and the authority: it steps the game's sim once per tick, decides every phase change and
 * publishes the sim's own snapshot. It adapts the M7.3a rules, each plain code with its own tests: the lobby,
 * the seat registry, the command ledger, the input meter and queue, and bot seats. `AutomataRoom` adapts this to
 * Colyseus, so every rule here is tested on a fake clock with fake clients.
 *
 * Per tick (spec §5): hold the clocks a test asked for → start play when the countdown ends → give up seats past
 * their grace → bots add their commands → take the due commands → `step` through the recorder → end play when the
 * game says so → refill budgets → every `snapshotEvery` ticks publish the snapshot with acks → tell new seats.
 *
 * Determinism (spec §4.4): every command `step` receives comes from here, the room's own seat and spawn commands
 * included, and every step while a game is recorded goes through `createRecorder`, so the replay alone reproduces
 * the room's final hash.
 */

import type { NetConfig, ServerMessage } from '@mcthaydt/automata-net'
import { SeatJoin, SeatLeave } from '@mcthaydt/automata-net/sim'
import { type Command, createRng, type Rng, type Sim } from '@mcthaydt/automata-sim'
import {
  createRecorder,
  packReplay,
  type Recorder,
  type ReplayCompression,
} from '@mcthaydt/automata-sim/replay'
import type { Bucket, RoomLogEvent } from '../game/server-config'
import { type CommandIntent, ROOM_SOURCE, type ServerDef } from '../game/server-game'
import { type SimView, simViewOf } from '../game/sim-view'
import { addBot, botSeed, removeBot } from '../rooms/bot-seats'
import { type ClockName, heldGraceSeconds, holdAllowed, pushHeldDeadlines } from '../rooms/clock-hold'
import { CommandLedger } from '../rooms/command-ledger'
import { InputMeter } from '../rooms/input-meter'
import { InputQueue, type QueuedInput } from '../rooms/input-queue'
import {
  acceptsInput,
  countdownElapsed,
  createLobby,
  endGame,
  evaluateReadiness,
  isPreGame,
  type LobbyRules,
  type LobbyState,
  openSeat,
  removeSeat,
  seatPlayer,
  setConnected,
  setReady,
  startGame,
  startOver,
} from '../rooms/lobby-rules'
import { RoomCommandError } from '../rooms/room-errors'
import { type SeatClient, SeatRegistry } from '../rooms/seat-registry'
import { nodeReplayCompression } from './replay-compression'
import { receiveMessage } from './room-messages'

/** A connected client as the room speaks to it: wire messages, binary and closing. */
export interface RoomClient extends SeatClient {
  send(message: ServerMessage): void
  sendBytes(bytes: Uint8Array): void
  /** Ends this client's connection (a `leave` request). */
  close(): void
}

/** `drained`: a draining room has nothing left to finish. `abandoned`: nobody is left who could come back. */
export type CloseReason = 'drained' | 'abandoned'

export interface RoomEngineOptions {
  readonly def: ServerDef
  /** The room's sim, created from the game's plugins, content and the room seed. The engine disposes it. */
  readonly sim: Sim
  /** The room seed: the sim's, and the root of each bot's stream. */
  readonly seed: number
  readonly net: NetConfig
  readonly commandsPerSeat: Bucket
  /** The room clock, in milliseconds: the tick scheduler's. Pings are measured on it. */
  readonly now: () => number
  /** Read for `NODE_ENV`: a clock hold is refused in production. */
  readonly env: Readonly<Record<string, string | undefined>>
  readonly log?: ((event: RoomLogEvent) => void) | undefined
  readonly compression?: ReplayCompression | undefined
  /** The room has nothing left to do and should close. Called once. */
  readonly onClose: (reason: CloseReason) => void
}

/** What became of one command a seat submitted. */
export type SubmitOutcome =
  | 'accepted'
  | 'late'
  | 'phase'
  | 'type'
  | 'payload'
  | 'rate'
  | 'sequence'
  | 'lead'
  | 'full'

/** A seat as the room tells clients about it (net's `SeatInfo`). */
export interface SeatInfoView {
  readonly seat: number
  readonly name: string
  readonly ready: boolean
  readonly connected: boolean
  readonly bot: boolean
}

/** The room as clients see it (net's `RoomInfo`, without the code and `you`, which the adapter and `seated` give). */
export interface RoomInfoView {
  readonly phase: LobbyState['phase']
  readonly hostSeat: number | undefined
  readonly seats: readonly SeatInfoView[]
}

interface BotSeat {
  readonly rng: Rng
  seq: number
}

export class RoomEngine {
  /** Read by `room-messages.ts`, the room's switchboard; not room API. */
  readonly def: ServerDef
  readonly sim: Sim
  readonly view: SimView
  readonly rules: LobbyRules
  readonly lobby: LobbyState = createLobby()
  readonly ledger: CommandLedger = new CommandLedger()
  readonly registry: SeatRegistry = new SeatRegistry()
  readonly lastPingAt: Map<string, number> = new Map()
  readonly now: () => number

  private readonly options: RoomEngineOptions
  private readonly queue: InputQueue
  private readonly meter: InputMeter
  private readonly graceTicks: number
  /** Connected clients by session; a dropped seat's client is gone until it returns. */
  private readonly clients = new Map<string, RoomClient>()
  /** Seat names, people's and bots'. */
  private readonly names = new Map<number, string>()
  private readonly bots = new Map<number, BotSeat>()
  /** Seats held after a drop, and the tick each is given up on. */
  private readonly drops = new Map<number, number>()
  /** Seats whose client has returned and not yet sent a command (see `submit`). */
  private readonly returned = new Set<number>()
  /** The last seq the room took for each seat: a snapshot's acks. */
  private readonly acks = new Map<number, number>()
  /** The room's own commands for the next tick: seat.join, seat.leave and spawns. */
  private roomCommands: Command[] = []
  private roomSeq = 0
  private recorder: Recorder | undefined
  private packedReplay: Promise<Uint8Array> | undefined
  private held: ReadonlySet<ClockName> = new Set()
  private isDraining = false
  private closed = false
  private emptySinceTick: number | undefined
  private lastStepAt: number | undefined

  constructor(options: RoomEngineOptions) {
    this.options = options
    this.def = options.def
    this.sim = options.sim
    this.view = simViewOf(options.sim)
    this.now = options.now
    const tickHz = options.sim.tickHz
    this.graceTicks = options.net.reconnectGraceSeconds * tickHz
    this.rules = {
      minSeats: options.def.seats.min,
      maxSeats: options.def.seats.max,
      countdownTicks: Math.round(options.def.lobby.countdownSeconds * tickHz),
      startWhen: options.def.lobby.startWhen,
    }
    this.queue = new InputQueue({ maxLeadTicks: options.net.maxLeadTicks, maxSequenceGap: this.graceTicks })
    this.meter = new InputMeter({
      capacity: options.commandsPerSeat.burst,
      creditsPerTick: options.commandsPerSeat.perSecond / tickHz,
    })
    // A room records from its first tick, so the replay holds every seat it ever seated (spec §4.3 Replay).
    this.recorder = createRecorder(options.sim)
  }

  // ── Reading ──

  get tick(): number {
    return this.sim.tick
  }

  get draining(): boolean {
    return this.isDraining
  }

  /** The packed replay of the last game, once play has ended; offered to every client then (spec §4.3). */
  get replay(): Promise<Uint8Array> | undefined {
    return this.packedReplay
  }

  /** The clocks held now (`clock-hold.ts`). */
  get heldClocks(): ClockName[] {
    return [...this.held]
  }

  /** The wall seconds Colyseus holds a dropped seat for. */
  get graceSeconds(): number {
    return heldGraceSeconds(this.held, this.options.net.reconnectGraceSeconds)
  }

  seatOf(session: string): number | undefined {
    return this.registry.seatOf(session)
  }

  info(): RoomInfoView {
    return {
      phase: this.lobby.phase,
      hostSeat: this.lobby.hostSeat,
      seats: this.lobby.seats.map((entry) => ({
        seat: entry.seat,
        name: this.names.get(entry.seat) ?? '',
        ready: entry.ready,
        connected: entry.connected,
        bot: entry.bot,
      })),
    }
  }

  // ── Seats ──

  /** Whether a new player may sit down now; throws the refusal a joining client is told. */
  admit(): void {
    if (this.isDraining) throw new RoomCommandError('SERVER_UPDATING', 'the server is updating')
    if (!isPreGame(this.lobby)) throw new RoomCommandError('REFUSED', 'this room is already playing')
    if (openSeat(this.lobby, this.rules) === undefined)
      throw new RoomCommandError('ROOM_FULL', 'every seat is taken')
  }

  /** Seats a joining player: `seat.join` and the game's spawn commands go to the sim on the next tick. */
  join(session: string, name: string, client: RoomClient): number {
    this.admit()
    const seat = seatPlayer(this.lobby, this.rules)
    this.names.set(seat, name)
    this.registry.seat(session, seat, client)
    this.clients.set(session, client)
    this.meter.fill(seat)
    this.seatInSim(seat, name)
    this.emptySinceTick = undefined
    evaluateReadiness(this.lobby, this.rules)
    return seat
  }

  /**
   * A connection lost rather than given up: the seat is held for the grace (on room ticks; the adapter holds
   * Colyseus's token as long), the player shown as dropped and their readiness cleared.
   */
  drop(session: string): void {
    const seat = this.registry.seatOf(session)
    if (seat === undefined) return
    this.clients.delete(session)
    this.drops.set(seat, this.sim.tick + this.graceTicks)
    setConnected(this.lobby, seat, false, this.rules)
    evaluateReadiness(this.lobby, this.rules)
  }

  /**
   * The dropped client is back, on a new connection. It is told its seat again on the next tick, as on a join. Its
   * numbering continues, unless its first command says it restarted (`submit`).
   */
  reconnect(session: string, client: RoomClient): void {
    const seat = this.registry.seatOf(session)
    if (seat === undefined) return
    this.registry.seat(session, seat, client)
    this.clients.set(session, client)
    this.drops.delete(seat)
    this.returned.add(seat)
    this.meter.fill(seat)
    setConnected(this.lobby, seat, true, this.rules)
    evaluateReadiness(this.lobby, this.rules)
    if (this.lobby.phase === 'ended' && this.packedReplay !== undefined) {
      const bytes = this.packedReplay
      void bytes.then((replay) => this.sendReplay(client, replay))
    }
  }

  /** Records how to cancel the Colyseus reconnection held for a dropped session. */
  hold(session: string, cancel: () => void): void {
    this.registry.hold(session, cancel)
  }

  /** The reconnection settled (the player came back, or Colyseus gave up). */
  endHold(session: string): void {
    this.registry.endHold(session)
  }

  /** A seat given up for good: a leave, or a drop the transport gave up on. Idempotent. */
  leave(session: string): void {
    const seat = this.registry.seatOf(session)
    if (seat === undefined) return
    this.registry.closeHold(session)
    this.freeSeat(session, seat)
  }

  /** The host's `bot.add`. Returns the bot's seat. */
  addBot(by: number): number {
    const seat = addBot(this.lobby, by, this.rules, this.def.game.bots !== undefined)
    const name = `Bot ${seat + 1}`
    this.names.set(seat, name)
    this.bots.set(seat, { rng: createRng(botSeed(this.options.seed, seat)), seq: 0 })
    this.seatInSim(seat, name)
    evaluateReadiness(this.lobby, this.rules)
    return seat
  }

  /** The host's `bot.remove`. */
  removeBot(by: number, seat: number): void {
    removeBot(this.lobby, by, seat)
    this.bots.delete(seat)
    this.forgetSeatNumbering(seat)
    this.names.delete(seat)
    this.roomCommand({ type: SeatLeave.id, payload: { seat } })
    evaluateReadiness(this.lobby, this.rules)
  }

  /**
   * A player's Ready. In an ended game, Ready is Play again: a fresh lobby, then the seat ready in it. A draining
   * room has finished what it was let run, so Play again closes it instead.
   */
  setReady(seat: number, ready: boolean): void {
    if (this.lobby.phase === 'ended' && ready) {
      if (this.isDraining) {
        this.close('drained')
        return
      }
      this.playAgain()
    }
    setReady(this.lobby, seat, ready, this.rules)
  }

  private seatInSim(seat: number, name: string): void {
    this.roomCommand({ type: SeatJoin.id, payload: { seat } })
    for (const intent of this.def.game.seat?.(seat, name) ?? []) this.roomCommand(intent)
  }

  /** Every way a seat comes free goes through here, so none can leave a piece behind. */
  private freeSeat(session: string, seat: number): void {
    this.registry.release(session)
    this.clients.delete(session)
    this.ledger.forget(session)
    this.lastPingAt.delete(session)
    this.meter.forget(seat)
    this.drops.delete(seat)
    this.forgetSeatNumbering(seat)
    this.names.delete(seat)
    removeSeat(this.lobby, seat, this.rules)
    this.roomCommand({ type: SeatLeave.id, payload: { seat } })
    evaluateReadiness(this.lobby, this.rules)
  }

  private forgetSeatNumbering(seat: number): void {
    this.queue.forget(seat)
    this.acks.delete(seat)
    this.returned.delete(seat)
  }

  private roomCommand(intent: CommandIntent): void {
    this.roomCommands.push({
      tick: 0,
      source: ROOM_SOURCE,
      seq: this.roomSeq,
      type: intent.type,
      payload: intent.payload,
    })
    this.roomSeq += 1
  }

  // ── Commands ──

  /** One wire message from a session, as text (`room-messages.ts`). */
  receive(session: string, raw: unknown): void {
    receiveMessage(this, session, raw)
  }

  /**
   * One command from a seat, on the room's only input path. `metered` is false for bots and the test driver, which
   * supply commands faster than a hand; every other rule still applies.
   *
   * A reloaded client (`NetRoom.resume`) numbers its commands from 0 again, while a client whose connection came
   * back continues its numbering and resends only what the next snapshot has not acked. So the first command after
   * a return tells them apart: seq 0 restarts the seat's numbering (`InputQueue.forget`, M7.3a's obligation); any
   * other continues it.
   */
  submit(seat: number, input: QueuedInput, metered: boolean): SubmitOutcome {
    if (!acceptsInput(this.lobby)) return 'phase'
    const command = this.def.clientCommand(input.type)
    if (command === undefined) return 'type'
    if (!command.schema.safeParse(input.payload).success) return 'payload'
    if (this.returned.delete(seat) && input.seq === 0) this.queue.forget(seat)
    if (metered && !this.meter.spend(seat)) return 'rate'
    const result = this.queue.submit(seat, input, this.sim.tick)
    if (!result.ok) return result.reason
    if (result.slack < 0) {
      this.log({ event: 'input.late', seat, count: -result.slack })
      return 'late'
    }
    return 'accepted'
  }

  /** The room's tick right now, fractional: the next tick less what remains of the wait for it (pings). */
  nowTicks(): number {
    if (this.lastStepAt === undefined) return this.sim.tick
    const since = (this.now() - this.lastStepAt) * (this.sim.tickHz / 1000)
    return this.sim.tick - 1 + Math.min(1, Math.max(0, since))
  }

  /** Sends one message to a connected session; a dropped one hears nothing. */
  answer(session: string, message: ServerMessage): void {
    this.clients.get(session)?.send(message)
  }

  /** A `leave` request: the seat is freed for good, then the connection closed. */
  leaveAndClose(session: string): void {
    const client = this.clients.get(session)
    this.leave(session)
    client?.close()
  }

  log(event: RoomLogEvent): void {
    this.options.log?.(event)
  }

  // ── The tick ──

  /** One tick of room time. The scheduler calls it; a test drives it by hand. */
  step(): void {
    if (this.closed) return
    const tick = this.sim.tick
    // A hold is for a room someone is looking at; once every person has dropped, nobody is.
    if (this.held.size > 0 && this.abandonedByPeople()) this.held = new Set()
    pushHeldDeadlines(this.lobby, this.drops, this.held)
    this.expireDrops(tick)
    this.driveBots(tick)

    const commands = [...this.queue.take(tick), ...this.roomCommands.map((command) => ({ ...command, tick }))]
    this.roomCommands = []
    for (const command of commands)
      if (command.source !== ROOM_SOURCE) this.acks.set(command.source, command.seq)

    this.lastStepAt = this.now()
    const recorder = this.recorder
    const result = recorder === undefined ? this.sim.step(commands) : recorder.step(commands)
    if (this.lobby.phase === 'playing' && this.def.game.ended?.(this.view, result.events) === true)
      this.finishGame()

    // The lobby keeps the tick the room steps next, so a countdown started between ticks counts from it, and play
    // starts in time for the tick the countdown ends on to take commands.
    this.lobby.tick = this.sim.tick
    if (countdownElapsed(this.lobby)) startGame(this.lobby)
    this.meter.refill(this.registry.seated())
    if (this.sim.tick % this.options.net.snapshotEvery === 0) this.publishSnapshot()
    this.registry.announce()
    this.closeIfDone()
  }

  /** Bots decide on the state the last tick left, and their commands take effect on this one, unmetered. */
  private driveBots(tick: number): void {
    const policy = this.def.game.bots
    if (policy === undefined || !acceptsInput(this.lobby)) return
    for (const seat of [...this.bots.keys()].sort((a, b) => a - b)) {
      const bot = this.bots.get(seat)
      if (bot === undefined) continue
      for (const intent of policy.commands(this.view, seat, bot.rng)) {
        this.queue.submit(seat, { seq: bot.seq, tick, type: intent.type, payload: intent.payload }, tick)
        bot.seq += 1
      }
    }
  }

  /** Gives up every dropped seat whose grace has run out: its token stops working and the sim hears `seat.leave`. */
  private expireDrops(tick: number): void {
    for (const [seat, deadline] of [...this.drops]) {
      if (tick < deadline) continue
      const session = this.registry.sessionOf(seat)
      if (session === undefined) {
        this.drops.delete(seat)
        continue
      }
      this.registry.closeHold(session)
      this.freeSeat(session, seat)
    }
  }

  private finishGame(): void {
    endGame(this.lobby)
    const replay = this.recorder?.finish()
    this.recorder = undefined
    if (replay === undefined) return
    const packed = packReplay(replay, this.options.compression ?? nodeReplayCompression)
    this.packedReplay = packed
    void packed.then(
      (bytes) => {
        for (const client of this.clients.values()) this.sendReplay(client, bytes)
      },
      () => this.log({ event: 'replay.failed' }),
    )
  }

  private sendReplay(client: RoomClient, bytes: Uint8Array): void {
    client.send({ t: 'replay' })
    client.sendBytes(bytes)
  }

  /** Play again: a fresh lobby on the same sim, recorded afresh from where the last game left it. */
  private playAgain(): void {
    startOver(this.lobby)
    this.packedReplay = undefined
    this.recorder = createRecorder(this.sim)
    for (const bot of this.bots.values()) bot.seq = 0
    for (const seat of this.bots.keys()) this.forgetSeatNumbering(seat)
  }

  private publishSnapshot(): void {
    if (this.clients.size === 0) return
    const acks: Record<string, number> = {}
    for (const seat of [...this.acks.keys()].sort((a, b) => a - b))
      acks[String(seat)] = this.acks.get(seat) ?? 0
    const header: ServerMessage = { t: 'snap', tick: this.sim.tick, hash: this.sim.hash(), acks }
    const bytes = this.sim.snapshot()
    for (const client of this.clients.values()) {
      client.send(header)
      client.sendBytes(bytes)
    }
  }

  // ── Holding, draining and closing ──

  /** Holds `names` and lets go of every other clock: test driver only, refused in production. */
  holdClocks(names: readonly ClockName[]): void {
    if (!holdAllowed(this.options.env)) throw new Error('a clock hold is refused in production')
    this.held = new Set(names)
  }

  /**
   * A deploy is under way (spec §4.3 Drain). A lobby closes now, so its players can carry on with the new build; a
   * countdown, a game and its results run on, and the room closes when it would go back to its lobby.
   */
  beginDrain(): void {
    if (this.isDraining) return
    this.isDraining = true
    this.closeIfDone()
  }

  private closeIfDone(): void {
    if (this.closed) return
    if (this.isDraining && this.lobby.phase === 'lobby') {
      this.close('drained')
      return
    }
    if (this.abandoned()) this.close('abandoned')
  }

  private close(reason: CloseReason): void {
    if (this.closed) return
    this.closed = true
    this.options.onClose(reason)
  }

  /**
   * Nobody is connected and nobody can come back: no client, and no seat held for one. A room whose first client is
   * still on its way (matchmaking reserved the seat; the socket has not arrived) is given the grace before it counts.
   */
  private abandoned(): boolean {
    if (this.clients.size > 0) {
      this.emptySinceTick = undefined
      return false
    }
    if (this.registry.size > 0) return false
    if (this.registry.everSeated) return true
    this.emptySinceTick ??= this.sim.tick
    return this.sim.tick - this.emptySinceTick >= this.graceTicks
  }

  /** People sat in the room and every one has since dropped: bots do not look at a screen. */
  private abandonedByPeople(): boolean {
    const people = this.lobby.seats.filter((entry) => !entry.bot)
    return people.length > 0 && people.every((entry) => !entry.connected)
  }

  /** Frees the sim. The room is closed. */
  dispose(): void {
    this.closed = true
    this.sim.dispose()
  }
}
