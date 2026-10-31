/**
 * The per-frame netcode loop (FloorFifty `race-netcode.ts`, made game-agnostic; M7 spec §4.2, §5 "per client frame").
 *
 * Three parts decide where the local player is: the authority clock (where the room is now), the input lead (how far
 * past it to predict) and the prediction (the room's last state plus this player's commands the room has not taken).
 * Input is sampled here, once per predicted tick, because *when* a command takes effect is the whole of making a
 * networked game play as if local: each command is stamped with the tick it is sampled for, applied to the predicted
 * sim on that tick and sent; the room holds it until that tick. The command the room receives and the one the
 * prediction steps are one object, so the two agree whenever it arrives in time, and the lead is set from the room's
 * own measurements so that it does.
 *
 * Per snapshot: reconcile (`prediction.ts`); a frame that fails its hash is not stepped on, and the next snapshot,
 * a full state every `snapshotEvery` ticks, is the resync. Two such frames within ten seconds end the session: a hash
 * that differs is a bug to investigate, never something to retry silently (spec §6).
 *
 * Plain code, no Effect: `frame` runs every rendered frame and `observe` twenty times a second (ADR 0003).
 * `makeNetSession` wires it to a `NetRoom`.
 */

import type { Command, Sim } from '@mcthaydt/automata-sim'
import type { NetSnapshot } from '../client/colyseus-transport'
import { InputLead, leadForRoundTrip } from './input-lead'
import type { NetDiagnostics } from './net-diagnostics'
import { Prediction } from './prediction'
import { RenderClock } from './render-clock'
import { type RemoteView, SnapshotBuffer } from './snapshot-buffer'

/** How often the clock is probed. Four a second is five seconds per lead window. */
export const PING_EVERY_MS = 250

/**
 * The most ticks one frame may sample. Twelve is a fifth of a second at 60 Hz, a hitch the loop can catch up on; past
 * it the gap is a hidden tab or a stalled device, and the loop re-seats at the present instead.
 */
export const MAX_CATCH_UP_TICKS = 12

/**
 * A backstop on unacked commands, past which a sample is dropped, neither applied nor sent. The real bound is the
 * expiry (a command unacked `maxLeadTicks` past its tick is given up). This is not the room's queue bound: the room's
 * 32 (server `MAX_QUEUED_COMMANDS`) counts commands that have arrived and are not yet due, while this counts every
 * command not yet acked (in flight both ways, about the lead plus a snapshot interval of ticks). At the 30-tick lead
 * cap that is a few dozen commands at one or two a tick; 256 leaves room for a busy game and still bounds a broken one.
 */
export const MAX_PENDING_COMMANDS = 256

/** Two hash mismatches this close together end the session (spec §6, N-d). */
export const DESYNC_WINDOW_MS = 10_000

/**
 * How far off authority the clock may be for a probe it sends to count. While the clock is still closing a gap (the
 * first frames of a game, a tab brought back) the tick a probe carries is not a fair reading, and the room's answer
 * would say the link is far slower than it is.
 */
const RELIABLE_CLOCK_ERROR_TICKS = 2

/** Probes awaited at once; one never answered is forgotten. */
const MAX_OUTSTANDING_PINGS = 16

/** One command a game samples: a sim command without the header the session stamps. */
export interface LocalCommand {
  readonly type: string
  readonly payload: unknown
}

/** The game's input for one predicted tick: the commands to apply and send on it, often none. */
export type Sampler = (tick: number) => readonly LocalCommand[]

/** One frame's answer: where authority is and the tick the predicted sim has stepped. */
export interface NetFrame<T = RemoteView> {
  readonly authorityTick: number
  readonly predictedTick: number
  /** The moment the others are drawn at: authority less the interpolation delay. */
  readonly renderTick: number
  /** The others at `renderTick`, blended from the authoritative states; undefined without a `remote` option or before one. */
  readonly remote: T | undefined
}

/** How the game draws the others (M7 spec §4.2): which entities are remote, read from each authoritative state, and how to blend. */
export interface RemoteSource<T = RemoteView> {
  /** The view of the remote entities in `sim`, right after a snapshot was restored (before the prediction steps on). */
  read(sim: Sim): T
  blend(from: T, to: T, t: number): T
}

/** Why the session stopped: a second snapshot hash mismatch within `DESYNC_WINDOW_MS`, at this snapshot tick. */
export interface SessionEnd {
  readonly reason: 'desync'
  readonly tick: number
}

/** What the room says about this player: their seat, and whether it takes input now. */
export interface SessionRoomState {
  readonly seat: number | undefined
  readonly accepting: boolean
}

export interface NetSessionOptions<T = RemoteView> {
  /** The client's sim: the game's plugins and content, as the room runs them. The session steps and restores it. */
  readonly sim: Sim
  /** Sends one stamped command (`ClientNetworkPort.sendCommand`). */
  readonly send?: ((command: Command) => void) | undefined
  /** Sends a clock probe for `tick`; its id, or undefined with no room (`ClientNetworkPort.ping`). */
  readonly ping?: ((tick: number) => number | undefined) | undefined
  /** The round trip measured before play, which seeds the lead. */
  readonly roundTripMs?: number | undefined
  /** net.toml's `maxLeadTicks`, past which the room refuses a command; the lead stays under half of it [60]. */
  readonly maxLeadTicks?: number | undefined
  /** Milliseconds (Effect's `Clock`). Without one, time is the sum of frame deltas. */
  readonly now?: (() => number) | undefined
  /** Called once, when the session ends. */
  readonly onEnd?: ((end: SessionEnd) => void) | undefined
  /** The others, drawn from the authoritative states (M7.5c). */
  readonly remote?: RemoteSource<T> | undefined
  /** net.toml's `snapshotEvery` [3]: the interpolation delay is never less than a snapshot's span. */
  readonly snapshotTicks?: number | undefined
  /** net.toml's `interpolationTicks` [6]: the delay a perfect link needs. */
  readonly interpolationTicks?: number | undefined
  /** Measures the link (round trips, snapshot gaps, the buffer); the session only feeds it. */
  readonly diagnostics?: NetDiagnostics | undefined
}

export class NetSession<T = RemoteView> {
  private readonly prediction: Prediction
  private readonly clock: RenderClock
  private readonly buffer: SnapshotBuffer<T> | undefined
  private readonly diagnostics: NetDiagnostics | undefined
  private readonly lead: InputLead
  private readonly send: (command: Command) => void
  private readonly ping: ((tick: number) => number | undefined) | undefined
  private readonly now: (() => number) | undefined
  private readonly onEnd: ((end: SessionEnd) => void) | undefined
  private seat: number | undefined
  private accepting = false
  /** The last tick input was sampled for: the tick the prediction stands at. */
  private inputTick: number | undefined
  /**
   * The next command's seq. Numbering starts at 1, as FloorFifty's does: the room reads seq 0 from a seat that has
   * just returned as a reloaded client restarting its numbering (M7.3b), so a resent first command must never be 0.
   */
  private nextSeq = 1
  private sincePing = Number.POSITIVE_INFINITY
  /** The lead each outstanding probe was sent with, and whether it can count, by id. */
  private readonly pings = new Map<
    number,
    { readonly lead: number; readonly reliable: boolean; readonly sentAt: number }
  >()
  /** Commands already sent a second time, by seq. */
  private readonly resent = new Set<number>()
  private virtualTime = 0
  private lastMismatchAt: number | undefined
  private mismatchCount = 0
  private end: SessionEnd | undefined
  /** One frame's answer, reused: `frame` allocates nothing (ADR 0003). */
  private readonly answer: {
    authorityTick: number
    predictedTick: number
    renderTick: number
    remote: T | undefined
  } = {
    authorityTick: 0,
    predictedTick: 0,
    renderTick: 0,
    remote: undefined,
  }

  constructor(options: NetSessionOptions<T>) {
    const tickHz = options.sim.tickHz
    const maxTicks = Math.floor((options.maxLeadTicks ?? 60) / 2)
    const interpolationTicks = options.interpolationTicks ?? 6
    const remote = options.remote
    this.buffer =
      remote === undefined
        ? undefined
        : new SnapshotBuffer<T>({ windowTicks: interpolationTicks * 8, blend: remote.blend })
    this.diagnostics = options.diagnostics
    this.prediction = new Prediction(options.sim, options.maxLeadTicks ?? 60, (tick) => {
      if (remote !== undefined) this.buffer?.push(tick, remote.read(options.sim))
    })
    this.clock = new RenderClock({
      tickHz,
      snapshotTicks: options.snapshotTicks ?? 3,
      baseDelayTicks: interpolationTicks,
      now: options.now,
    })
    this.lead = new InputLead(leadForRoundTrip(options.roundTripMs, { tickHz, maxTicks }), {
      tickHz,
      maxTicks,
    })
    this.send = options.send ?? (() => undefined)
    this.ping = options.ping
    this.now = options.now
    this.onEnd = options.onEnd
  }

  /** The seat and whether the room takes input; until both say yes, sampled commands are dropped. */
  setRoomState(state: SessionRoomState): void {
    this.seat = state.seat
    this.accepting = state.accepting
  }

  /**
   * One authoritative snapshot, timestamped with when it arrived. It reconciles the prediction and steers the clock;
   * then numbering goes on from the seat's ack (a reloaded page takes over a seat the room kept counting for), and a
   * command the room has stepped past without taking is sent once more.
   */
  observe(snapshot: NetSnapshot, receivedAt?: number): void {
    if (this.end !== undefined) return
    this.diagnostics?.snapshot(snapshot.tick)
    const outcome = this.prediction.reconcile(snapshot, this.seat, this.inputTick)
    if (outcome === 'mismatch') {
      this.mismatch(snapshot.tick, receivedAt ?? this.time())
      return
    }
    // Every frame that passed its hash steers the clock, as FloorFifty's did: one at or behind the newest changes
    // nothing there, and one far behind (a restarted timeline) moves it back once half a second agrees.
    this.clock.observe(snapshot.tick, receivedAt)
    if (outcome === 'stale') return
    const ack = this.seat === undefined ? undefined : snapshot.acks[String(this.seat)]
    if (ack !== undefined && ack + 1 > this.nextSeq) this.nextSeq = ack + 1
    this.resendOverdue(snapshot.tick)
  }

  /**
   * Advances one rendered frame, sampling input for the latest tick it reaches. Undefined before the first snapshot
   * (there is no game to be at a moment of) and once the session has ended. The answer is one object, reused: read it
   * before the next frame.
   */
  frame(sample: Sampler, deltaMs: number): NetFrame<T> | undefined {
    if (this.end !== undefined) return undefined
    if (this.now === undefined) this.virtualTime += deltaMs
    this.clock.advance(deltaMs)
    if (this.clock.takeRestart()) {
      // The clock adopted a restarted timeline. The prediction stands on the old one, far ahead, and no snapshot of
      // the new one is newer than its base: it starts again from the next snapshot instead of standing frozen.
      this.prediction.clear()
      this.inputTick = undefined
    }
    this.lead.advance(deltaMs)
    const authority = this.clock.authorityTick()
    if (authority === undefined) return undefined

    this.sampleUpTo(Math.floor(authority + this.lead.ticks), sample)

    this.sincePing += deltaMs
    if (this.sincePing >= PING_EVERY_MS && this.ping !== undefined) {
      this.sincePing = 0
      const id = this.ping(authority + this.lead.ticks)
      if (id !== undefined) {
        this.pings.set(id, {
          sentAt: this.time(),
          lead: this.lead.ticks,
          reliable: Math.abs(this.clock.error) <= RELIABLE_CLOCK_ERROR_TICKS,
        })
        if (this.pings.size > MAX_OUTSTANDING_PINGS) {
          const oldest = this.pings.keys().next().value
          if (oldest !== undefined) this.pings.delete(oldest)
        }
      }
    }
    const drawn = this.clock.current() ?? authority
    this.answer.authorityTick = authority
    this.answer.predictedTick = this.inputTick as number
    this.answer.renderTick = drawn
    this.answer.remote = this.buffer?.sample(drawn)
    if (this.diagnostics !== undefined) {
      const reach = this.buffer?.reach(drawn)
      if (reach !== undefined) this.diagnostics.buffer(reach)
      this.diagnostics.clock({
        error: this.clock.error,
        delayTicks: this.clock.interpolationDelay,
        snaps: this.clock.snaps,
      })
      this.diagnostics.poll()
    }
    return this.answer
  }

  /** The room answered a probe: a reliable one steers the lead. Another's probe (NetRoom's own) is ignored. */
  pong(pong: { readonly id: number; readonly slack: number }): void {
    const sent = this.pings.get(pong.id)
    this.pings.delete(pong.id)
    if (sent !== undefined) this.diagnostics?.roundTrip(Math.max(0, this.time() - sent.sentAt))
    if (sent?.reliable === true) this.lead.observe(sent.lead, pong.slack)
  }

  /**
   * The connection came back. Commands sent while it was down went nowhere, so every one the room has not acked is
   * sent again, with its own seq and tick: the room takes a late one on its next tick and refuses one it already has.
   */
  resync(): void {
    if (this.end !== undefined) return
    for (const command of this.prediction.pendingCommands) {
      this.resent.add(command.seq)
      this.send(command)
    }
  }

  /**
   * Forgets the game, as leaving it does: its snapshots, commands, numbering and any desync. The next room numbers
   * from 1, or from its own ack when this player is taking over a seat it kept counting for (`observe`).
   */
  clear(): void {
    this.nextSeq = 1
    this.end = undefined
    this.lastMismatchAt = undefined
    this.mismatchCount = 0
    this.prediction.clear()
    this.clock.clear()
    this.buffer?.clear()
    this.diagnostics?.reset()
    this.inputTick = undefined
    this.sincePing = Number.POSITIVE_INFINITY
    this.pings.clear()
    this.resent.clear()
  }

  /** The tick input was last sampled for, or undefined before the first frame. */
  get sampledTick(): number | undefined {
    return this.inputTick
  }

  /** The lead in ticks. */
  get leadTicks(): number {
    return this.lead.ticks
  }

  /** Where authority is now, on the one clock. */
  authorityTick(): number | undefined {
    return this.clock.authorityTick()
  }

  /** Why the session ended; undefined while it runs. */
  get ended(): SessionEnd | undefined {
    return this.end
  }

  /** Snapshot frames that failed their hash, in all. */
  get mismatches(): number {
    return this.mismatchCount
  }

  /** The last snapshot restored, by tick and hash. */
  get authoritative(): { readonly tick: number; readonly hash: string } | undefined {
    return this.prediction.authoritative
  }

  /** The local commands the room has not acked yet. */
  get pendingCommands(): readonly Command[] {
    return this.prediction.pendingCommands
  }

  private time(): number {
    return this.now?.() ?? this.virtualTime
  }

  private mismatch(tick: number, at: number): void {
    this.mismatchCount += 1
    const previous = this.lastMismatchAt
    this.lastMismatchAt = at
    if (previous === undefined || at - previous > DESYNC_WINDOW_MS) return
    this.end = { reason: 'desync', tick }
    this.onEnd?.(this.end)
  }

  /**
   * A command whose tick is before the snapshot's, and not acked, was lost or is late. Sending it once more costs a
   * refusal at worst (the room refuses a seq it has had) and saves a command lost for good. Once, so a slow link does
   * not resend every command on every snapshot.
   */
  private resendOverdue(tick: number): void {
    const pending = this.prediction.pendingCommands
    for (const seq of [...this.resent])
      if (!pending.some((command) => command.seq === seq)) this.resent.delete(seq)
    for (const command of pending) {
      if (command.tick >= tick || this.resent.has(command.seq)) continue
      this.resent.add(command.seq)
      this.diagnostics?.lateCommand()
      this.send(command)
    }
  }

  /**
   * Brings input and the prediction up to `target`: sample once, stamp, step. A frame that covers several ticks could
   * only notice a key now, so its commands are stamped with the latest tick it reaches; the ticks before are stepped
   * with what is already pending. Re-seated rather than caught up after a long gap either way: forward, so a hidden
   * tab does not sample hundreds of ticks; backward, so a clock that lands far behind never leaves input dead.
   */
  private sampleUpTo(target: number, sample: Sampler): void {
    if (this.inputTick === undefined || Math.abs(target - this.inputTick) > MAX_CATCH_UP_TICKS)
      this.inputTick = target - 1
    if (this.inputTick >= target) return

    this.prediction.advanceThrough(target - 1)
    this.inputTick = target
    const commands = sample(target)
    const seat = this.seat
    if (this.accepting && seat !== undefined) {
      for (const local of commands) {
        if (this.prediction.pendingCommands.length >= MAX_PENDING_COMMANDS) break
        const command: Command = {
          tick: target,
          source: seat,
          seq: this.nextSeq,
          type: local.type,
          payload: local.payload,
        }
        this.nextSeq += 1
        this.prediction.record(command)
        this.send(command)
      }
    }
    this.prediction.advanceThrough(target)
  }
}
