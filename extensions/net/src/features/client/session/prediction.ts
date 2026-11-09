/**
 * The predicted local state.
 *
 * The client steps the same sim the room runs, from the last authoritative snapshot, with the local commands the room
 * has not acked yet. Every snapshot replaces the state: restore its bytes, check its hash, drop what it acks and step
 * forward again to where input has been sampled. Nothing is merged or nudged: the room's state is the truth, and
 * the prediction is the room's state plus this player's own commands that the room has not taken yet. The client steps the same
 * simulation the server runs, over a state rebuilt from the last snapshot (the sim's own bytes).
 *
 * Ticks: core's `Sim.tick` is the next tick to step. A snapshot at T is the state before tick T, and its acks cover
 * every command the room took through T - 1. So a command not acked whose tick is before T arrived late (or was lost)
 * and the room takes it on the first tick it steps after it arrives: re-stepping from T, it goes on T. And a command
 * never takes effect before one sent ahead of it (the room's input queue has the same two rules).
 *
 * A frame whose hash differs after `restore` is never stepped on: the sim goes back to the last good snapshot and is
 * stepped forward again, which is exactly the prediction it held before the frame came (the same base, the same
 * commands). Bytes that `restore` refuses leave the sim untouched (core's rule). Plain code, no Effect per step.
 */

import type { Command, Sim } from '@automata/sim'
import type { NetSnapshot } from '../room/colyseus-transport'

const NO_COMMANDS: readonly Command[] = Object.freeze([])

/** What a frame did to the prediction: restored it, was older than the last one, or failed its hash. */
export type ReconcileOutcome = 'restored' | 'stale' | 'mismatch'

interface Base {
  readonly tick: number
  readonly bytes: Uint8Array
  readonly hash: string
  /** False for the sim's starting state, which no snapshot vouched for. */
  readonly authoritative: boolean
}

export class Prediction {
  private readonly sim: Sim
  private readonly start: Base
  private base: Base
  /** Local commands the room has not acked, in `seq` order. */
  private pending: Command[] = []
  /** How many of `pending` the sim has applied since it was last put on `base`. */
  private applied = 0

  private readonly expireAfterTicks: number

  /**
   * `expireAfterTicks`: how long past its tick an unacked command is kept. Past it the room has refused the command
   * or never had it (net.toml's `maxLeadTicks`: a sent command had its resend long before), so it is given up and
   * the prediction stops replaying it.
   */
  /** Called with the snapshot's tick right after its state is restored and its hash has passed, before the sim is stepped on. */
  private readonly onRestored: ((tick: number) => void) | undefined

  constructor(sim: Sim, expireAfterTicks = 60, onRestored?: (tick: number) => void) {
    this.onRestored = onRestored
    this.sim = sim
    this.expireAfterTicks = expireAfterTicks
    this.start = { tick: sim.tick, bytes: sim.snapshot(), hash: sim.hash(), authoritative: false }
    this.base = this.start
  }

  /** The local commands not acked yet, oldest first. */
  get pendingCommands(): readonly Command[] {
    return this.pending
  }

  /** The last snapshot restored, by its tick and hash; undefined before one. */
  get authoritative(): { readonly tick: number; readonly hash: string } | undefined {
    return this.base.authoritative ? { tick: this.base.tick, hash: this.base.hash } : undefined
  }

  /** A local command, stamped and sent: it takes effect when its tick is stepped. */
  record(command: Command): void {
    this.pending.push(command)
  }

  /** Steps the sim until it has stepped `tick` (its `tick` is then `tick + 1`); a sim already past it is left. */
  advanceThrough(tick: number): void {
    while (this.sim.tick <= tick) this.stepOnce()
  }

  /**
   * One authoritative snapshot. `seat` is this client's (its ack is read from the header); `through` is the tick
   * input has been sampled for, which the sim is stepped forward to again.
   */
  reconcile(snapshot: NetSnapshot, seat: number | undefined, through: number | undefined): ReconcileOutcome {
    if (this.base.authoritative && snapshot.tick <= this.base.tick) return 'stale'
    try {
      this.sim.restore(snapshot.bytes)
    } catch {
      // Core refused the bytes and left the sim as it was: the prediction stands.
      return 'mismatch'
    }
    const hash = this.sim.hash()
    if (hash !== snapshot.hash) {
      this.putOn(this.base)
      if (through !== undefined) this.advanceThrough(through)
      return 'mismatch'
    }
    this.base = { tick: snapshot.tick, bytes: snapshot.bytes, hash, authoritative: true }
    const ack = seat === undefined ? undefined : snapshot.acks[String(seat)]
    const expired = snapshot.tick - this.expireAfterTicks
    if (this.pending.some((command) => command.seq <= (ack ?? -1) || command.tick < expired))
      this.pending = this.pending.filter((command) => command.seq > (ack ?? -1) && command.tick >= expired)
    this.applied = 0
    this.onRestored?.(snapshot.tick)
    if (through !== undefined) this.advanceThrough(through)
    return 'restored'
  }

  /** Forgets every command and the last snapshot; the sim goes back to where it started. */
  clear(): void {
    this.pending = []
    this.base = this.start
    this.putOn(this.start)
  }

  private putOn(base: Base): void {
    this.sim.restore(base.bytes)
    this.applied = 0
  }

  /**
   * Steps one tick with every pending command due by it, in `seq` order: one whose tick has passed goes now, and none
   * goes before an earlier one, which is the room's queue rule (`max(stamped, next tick, the last one's)`).
   */
  private stepOnce(): void {
    const tick = this.sim.tick
    // Most ticks have no local command: they step with one shared empty list and allocate nothing.
    let due: Command[] | undefined
    while (this.applied < this.pending.length) {
      const command = this.pending[this.applied] as Command
      if (command.tick > tick) break
      due ??= []
      due.push(command.tick === tick ? command : { ...command, tick })
      this.applied += 1
    }
    this.sim.step(due ?? NO_COMMANDS)
  }
}
