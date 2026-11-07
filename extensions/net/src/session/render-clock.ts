/**
 * The drawn moment (the interpolation half of FloorFifty's `render-clock.ts`; M7 spec §4.2).
 *
 * Authority arrives at the snapshot rate while the screen draws at its own, so remote entities are drawn a little behind
 * authority, interpolated between the pair of snapshots that brackets that moment. The delay adapts to the link: it is measured
 * from how late snapshots arrive against the clock's own steady estimate and set to cover the late tail of the last three seconds
 * (the spread below the median), never below the base a perfect link needs and never above a quarter second. It is eased, at five
 * percent of elapsed time, because it changes how fast every other entity appears to move: a moment of slow motion is better than
 * a lurch. The delay is applied to the *drawn* moment and never to authority, so changing it cannot move the input timeline.
 *
 * This produces a time, never a position. What is drawn at that time is the snapshot buffer's business. Plain code, no Effect:
 * it runs every frame (ADR 0003).
 */
import { AuthorityClock, SNAP_TICKS } from './authority-clock'

/** Arrivals remembered for the jitter estimate: three seconds of snapshots at 20 Hz. */
const ARRIVAL_WINDOW = 60
/** How fast the delay may change: five percent of elapsed time (half the rate skew's bound). */
const DELAY_SLEW = 0.05
/** Headroom kept above the latest arrival the window has seen, in ticks. */
const DELAY_MARGIN_TICKS = 0.5
/** The longest the others are ever drawn behind authority, in seconds. */
export const MAX_DELAY_SECONDS = 0.25

const percentile = (sorted: readonly number[], fraction: number): number => {
  if (sorted.length === 0) return 0
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(fraction * sorted.length) - 1))
  return sorted[rank] as number
}

export interface RenderClockOptions {
  readonly tickHz: number
  /** Ticks between snapshots (`net.toml` `snapshotEvery`). */
  readonly snapshotTicks: number
  /** The delay a perfect link needs (`net.toml` `interpolationTicks`). */
  readonly baseDelayTicks: number
  /** Milliseconds, as for the authority clock. */
  readonly now?: (() => number) | undefined
}

export class RenderClock {
  private readonly authority: AuthorityClock
  private readonly tickMs: number
  private readonly base: number
  private readonly snapshotTicks: number
  private readonly maxDelay: number
  private delay: number
  private delayTarget: number
  /** How far ahead of the clock recent snapshots arrived, in ticks. Negative is late. */
  private readonly arrivals: number[] = []
  private newest = Number.NEGATIVE_INFINITY
  private lastAt = 0
  private seenSnaps = 0

  constructor(options: RenderClockOptions) {
    this.authority = new AuthorityClock({ tickHz: options.tickHz, now: options.now })
    this.tickMs = 1000 / options.tickHz
    this.base = options.baseDelayTicks
    this.snapshotTicks = options.snapshotTicks
    this.maxDelay = Math.max(options.baseDelayTicks, MAX_DELAY_SECONDS * options.tickHz)
    this.delay = options.baseDelayTicks
    this.delayTarget = options.baseDelayTicks
  }

  /** Adopts a snapshot's tick; it never moves the clock itself, and it measures how early the snapshot came. */
  observe(tick: number, receivedAt?: number): void {
    const at = receivedAt ?? this.authority.timeNow()
    const first = this.authority.authorityTick() === undefined
    const estimate = this.authority.authorityAt(at)
    this.authority.observe(tick, at)
    if (first) {
      this.lastAt = at
      this.newest = tick
      return
    }
    const restarted = tick < this.newest - SNAP_TICKS
    if (tick <= this.newest && !restarted) return
    this.newest = tick
    if (estimate !== undefined && Math.abs(tick - estimate) <= SNAP_TICKS) this.recordArrival(tick - estimate)
  }

  /**
   * One arrival, measured against the clock's own steady estimate. The drawn moment runs `delay` behind that estimate and a
   * snapshot covers the next `snapshotTicks`, so the buffer runs dry just before the next arrival whenever one arrives later than
   * the delay allows for. The delay is set to cover the late tail of the window.
   */
  private recordArrival(earlyTicks: number): void {
    this.arrivals.push(earlyTicks)
    if (this.arrivals.length > ARRIVAL_WINDOW) this.arrivals.shift()
    const sorted = [...this.arrivals].sort((a, b) => a - b)
    const lateTail = percentile(sorted, 0.5) - percentile(sorted, 0.05)
    const needed = this.snapshotTicks + lateTail + DELAY_MARGIN_TICKS
    this.delayTarget = Math.min(this.maxDelay, Math.max(this.base, needed))
  }

  /** Advances to this frame and returns the moment to draw; undefined before the first snapshot. */
  advance(deltaMs: number): number | undefined {
    if (this.authority.authorityTick() === undefined) return undefined
    this.authority.advance(deltaMs)
    const at = this.authority.timeNow()
    const ticks = Math.max(0, at - this.lastAt) / this.tickMs
    this.lastAt = at
    if (this.authority.snaps !== this.seenSnaps) {
      // Whatever the window measured belonged to the time before the jump.
      this.seenSnaps = this.authority.snaps
      this.arrivals.length = 0
    }
    const step = ticks * DELAY_SLEW
    this.delay += Math.max(-step, Math.min(step, this.delayTarget - this.delay))
    return this.current()
  }

  /** The moment being drawn, without advancing. */
  current(): number | undefined {
    const authority = this.authority.authorityTick()
    return authority === undefined ? undefined : authority - this.delay
  }

  /** Where authority is now, on the one clock. */
  authorityTick(): number | undefined {
    return this.authority.authorityTick()
  }

  /** How far the authority clock trails its anchor, in ticks. */
  get error(): number {
    return this.authority.error
  }

  /** Whether the clock moved back to a restarted timeline since the last call; true once per restart. */
  takeRestart(): boolean {
    return this.authority.takeRestart()
  }

  /** How far behind authority the others are drawn, now. */
  get interpolationDelay(): number {
    return this.delay
  }

  /** How many times the authority clock has jumped. */
  get snaps(): number {
    return this.authority.snaps
  }

  /** Forgets the room, as leaving does. */
  clear(): void {
    this.authority.clear()
    this.delay = this.base
    this.delayTarget = this.base
    this.arrivals.length = 0
    this.newest = Number.NEGATIVE_INFINITY
    this.lastAt = 0
    this.seenSnaps = 0
  }
}
