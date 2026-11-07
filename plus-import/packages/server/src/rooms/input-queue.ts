/**
 * When each seat's commands take effect (FloorFifty `input-queue.ts`, generic over the sim's `Command`).
 *
 * A client stamps every command with the tick it predicted it on, and this holds the command until the room
 * reaches that tick. That is the whole of input alignment: the client and the server apply the same command on the
 * same tick, so prediction and authority step the same sim and agree to the bit, however long the command spent on
 * the wire, provided it arrived in time.
 *
 * Two rules keep a bad link from becoming a bad game. A command that arrives after its tick takes effect on the
 * next tick the room steps: late, never rewound, never refused for it (SV-b). And sequence order is intent order:
 * a command never takes effect before one its client sent ahead of it, whatever tick it was stamped with.
 *
 * FloorFifty held the newest frame in force on every tick and collapsed a burst to it. An AF command is an edge:
 * each is delivered exactly once, on its tick, and whatever intent it sets lives in the sim's state, so the replay
 * holds exactly what `step` received.
 *
 * The server sets `source` from the connection's seat and `tick` from this queue; a client's `source` is never
 * read (M7 spec §4.3). No I/O and no clock: the room says what tick it is.
 */

import type { Command } from '@mcthaydt/automata-sim'

/**
 * Commands one seat may have waiting. A client leads the room by a round trip, so an honest queue holds a handful;
 * thirty-two is generous for a hand on a controller and still a bound for a client that is not one (spec §4.3).
 */
export const MAX_QUEUED_COMMANDS = 32

/** What a client sends for the sim: a command without `source`, which the seat supplies. */
export type QueuedInput = Pick<Command, 'seq' | 'tick' | 'type' | 'payload'>

/**
 * `tick` is when the command will take effect. `slack` is how many ticks early it arrived: its stamped tick minus
 * the next tick the room steps. Zero is exactly in time; negative is late, which the room logs as `input.late`.
 */
export type SubmitResult =
  | { readonly ok: true; readonly tick: number; readonly slack: number }
  | { readonly ok: false; readonly reason: 'sequence' | 'lead' | 'full' }

export interface InputQueueOptions {
  /** How far ahead of the room a command may be stamped: net's `maxLeadTicks`. One at that lead is refused. */
  readonly maxLeadTicks: number
  /**
   * How far a sequence may jump past the last accepted one. A command far ahead of the last one is not a fast client
   * but a client that has lost track. FloorFifty used its reconnect grace in ticks.
   */
  readonly maxSequenceGap: number
}

interface SeatQueue {
  /** Highest sequence accepted, kept across a disconnect so a reconnect continues it; -1 before the first. */
  lastSeq: number
  /** The effective tick of the newest accepted command; later commands never precede it. */
  lastTick: number
  /** Accepted commands not yet taken, in sequence order and so in tick order. */
  readonly pending: { readonly input: QueuedInput; readonly tick: number }[]
}

export class InputQueue {
  /** Indexed by seat, so taking walks the seats in seat order. */
  private readonly seats: (SeatQueue | undefined)[] = []
  private readonly options: InputQueueOptions

  constructor(options: InputQueueOptions) {
    this.options = options
  }

  private queueOf(seat: number): SeatQueue {
    let queue = this.seats[seat]
    if (queue === undefined) {
      queue = { lastSeq: -1, lastTick: 0, pending: [] }
      this.seats[seat] = queue
    }
    return queue
  }

  /** Accepts one command from `seat`, given the tick the room steps next (the sim's `tick` before `step`). */
  submit(seat: number, input: QueuedInput, nextTick: number): SubmitResult {
    const queue = this.queueOf(seat)
    if (input.seq <= queue.lastSeq) return { ok: false, reason: 'sequence' }
    if (input.seq > queue.lastSeq + this.options.maxSequenceGap) return { ok: false, reason: 'sequence' }
    if (input.tick - nextTick >= this.options.maxLeadTicks) return { ok: false, reason: 'lead' }
    if (queue.pending.length >= MAX_QUEUED_COMMANDS) return { ok: false, reason: 'full' }

    const tick = Math.max(input.tick, nextTick, queue.lastTick)
    queue.lastSeq = input.seq
    queue.lastTick = tick
    queue.pending.push({
      input: { seq: input.seq, tick: input.tick, type: input.type, payload: input.payload },
      tick,
    })
    return { ok: true, tick, slack: input.tick - nextTick }
  }

  /**
   * Every command due by `tick`, stamped `tick` with its seat as `source`, in seat order and then sequence order.
   * Called once per room tick, just before the sim steps `tick`.
   */
  take(tick: number): Command[] {
    const due: Command[] = []
    for (let seat = 0; seat < this.seats.length; seat += 1) {
      const pending = this.seats[seat]?.pending
      if (pending === undefined) continue
      let count = 0
      for (const { input, tick: dueTick } of pending) {
        if (dueTick > tick) break
        due.push({ tick, source: seat, seq: input.seq, type: input.type, payload: input.payload })
        count += 1
      }
      if (count > 0) pending.splice(0, count)
    }
    return due
  }

  /**
   * Forgets a seat that has been given up, numbering and all. The room also calls it when a seat is resumed by a
   * reloaded client (`NetRoom.resume`), whose sequence starts again; a transport reconnect keeps the client's state
   * and continues its numbering, so it is not forgotten.
   */
  forget(seat: number): void {
    this.seats[seat] = undefined
  }

  /** Forgets every seat, as a new game does. */
  reset(): void {
    this.seats.length = 0
  }
}
