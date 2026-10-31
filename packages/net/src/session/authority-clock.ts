/**
 * Where the room is now, on one clock (the authority half of FloorFifty's `render-clock.ts`; M7 spec §4.2).
 *
 * Authority arrives at the snapshot rate and the display draws at its own, so something has to say what tick the
 * room is at between two snapshots. Taking it from the newest snapshot steps once per packet and passes jitter
 * straight through. So this clock runs on rendered time and snapshots only steer it: each snapshot re-anchors where
 * authority should be, and between snapshots the anchor free-runs at the nominal rate. The error between the two is
 * bled off by running a few percent fast or slow, which corrects drift in a fraction of a second and is far below what
 * a player can see. Past a fifth of a second of error (a resumed tab, a stall, a reconnect) the clock jumps instead.
 *
 * An anchor is a tick *at a time*: a snapshot says where authority was when it arrived, so arrivals are timestamped,
 * and whether to snap is decided once per frame against the freshest anchor rather than on each snapshot of a burst.
 *
 * The prediction leads this clock by the input lead; M7.5c's render clock draws the others an interpolation delay
 * behind it. Plain code, no Effect: it runs every frame (ADR 0003).
 */

/** Rate skew per tick of error; with the cap below it saturates at two ticks of error. */
const CORRECTION_PER_TICK_OF_ERROR = 0.05

/** The furthest the rate may stray from nominal: closes a tick of error in well under a second, unseen. */
const MAX_RATE_SKEW = 0.1

/**
 * Error past which the clock jumps rather than eases: a fifth of a second at 60 Hz, far more than jitter or drift can
 * produce and far less than a resumed tab or a reconnect.
 */
const SNAP_TICKS = 12

/**
 * How long every snapshot must say the clock is ahead before it moves back. A snapshot's tick is a lower bound on the
 * room's: it can only have aged in transit. One far *ahead* proves the clock behind, and the clock jumps at once. One
 * far *behind* proves nothing alone (a long task on the page holds snapshots back, then delivers them as fresh); half
 * a second of every snapshot agreeing is a room that really did move its timeline back.
 */
const BACKWARD_SNAP_AFTER_MS = 500

const clamp = (value: number, limit: number): number => Math.max(-limit, Math.min(limit, value))

export interface AuthorityClockOptions {
  /** The sim's tick rate. */
  readonly tickHz: number
  /**
   * Milliseconds (Effect's `Clock` in the session). Without one, time is the sum of the deltas `advance` is given,
   * which is exact for a test that says what time it is by drawing frames.
   */
  readonly now?: (() => number) | undefined
}

export class AuthorityClock {
  private readonly tickMs: number
  private readonly now: (() => number) | undefined
  /** Where authority is, on this clock, as of the last frame. Fractional. */
  private authority: number | undefined
  /** When the last frame ran. */
  private lastAdvanceAt = 0
  /** The newest snapshot's tick and when it arrived. */
  private anchorTick = 0
  private anchorAt = 0
  /** The newest tick observed, so a repeated snapshot cannot drag the anchor back. */
  private newest = Number.NEGATIVE_INFINITY
  private virtualTime = 0
  /** When the clock first ran too far ahead of its anchor, while it still is. */
  private aheadSince: number | undefined
  /** The clock moved back to a restarted timeline since `takeRestart` last asked. */
  private restarted = false

  constructor(options: AuthorityClockOptions) {
    this.tickMs = 1000 / options.tickHz
    this.now = options.now
  }

  private time(): number {
    return this.now?.() ?? this.virtualTime
  }

  private anchorAtTime(at: number): number {
    return this.anchorTick + (at - this.anchorAt) / this.tickMs
  }

  /**
   * Adopts a snapshot's tick as the anchor; it never moves the clock itself (the next frame decides). A tick at or
   * behind the newest changes nothing, unless it is far behind: a restarted timeline, which is adopted.
   */
  observe(tick: number, receivedAt?: number): void {
    const at = receivedAt ?? this.time()
    if (this.authority === undefined) {
      this.authority = tick
      this.lastAdvanceAt = at
      this.anchorTick = tick
      this.anchorAt = at
      this.newest = tick
      return
    }
    const restarted = tick < this.newest - SNAP_TICKS
    if (tick <= this.newest && !restarted) return
    this.newest = tick
    this.anchorTick = tick
    this.anchorAt = at
  }

  /** How far the clock's authority trails its anchor, in ticks. Zero before the first snapshot. */
  get error(): number {
    return this.authority === undefined ? 0 : this.anchorAtTime(this.lastAdvanceAt) - this.authority
  }

  /** Where authority is now; undefined before the first snapshot. */
  authorityTick(): number | undefined {
    return this.authority
  }

  /** Advances to this frame and returns where authority is. With a time source, the frame's length is read from it. */
  advance(deltaMs: number): number | undefined {
    if (this.authority === undefined) return undefined
    if (this.now === undefined) this.virtualTime += deltaMs
    const at = this.time()
    const ticks = Math.max(0, at - this.lastAdvanceAt) / this.tickMs

    // Where this frame puts authority at the nominal rate, against where the freshest anchor puts it at the same
    // instant. Both have moved by the frame, so neither gets a head start.
    const projected = this.authority + ticks
    const behind = this.anchorAtTime(at) - projected
    this.lastAdvanceAt = at

    if (behind < -SNAP_TICKS) this.aheadSince ??= at
    else this.aheadSince = undefined
    const believedAhead = this.aheadSince !== undefined && at - this.aheadSince >= BACKWARD_SNAP_AFTER_MS

    if (behind < -SNAP_TICKS && !believedAhead) {
      // Probably a late delivery: run on and wait for the next snapshot to say whether the clock really is ahead.
      this.authority = projected
    } else if (Math.abs(behind) > SNAP_TICKS) {
      // Too far to ease: land exactly where the freshest anchor says authority is now. Back (only after half a second
      // of agreement) is a restarted timeline, which the prediction must follow.
      if (behind < 0) this.restarted = true
      this.aheadSince = undefined
      this.authority = this.anchorAtTime(at)
    } else {
      // The correction closes the error and never passes it: a long frame at a skewed rate would overshoot.
      const skew = clamp(behind * CORRECTION_PER_TICK_OF_ERROR, MAX_RATE_SKEW)
      const correction = Math.min(Math.abs(behind), Math.abs(ticks * skew))
      this.authority = projected + Math.sign(behind) * correction
    }
    return this.authority
  }

  /** Whether the clock moved back to a restarted timeline since the last call; true once per restart. */
  takeRestart(): boolean {
    const restarted = this.restarted
    this.restarted = false
    return restarted
  }

  /** Forgets the room's timeline. */
  clear(): void {
    this.authority = undefined
    this.lastAdvanceAt = 0
    this.anchorTick = 0
    this.anchorAt = 0
    this.newest = Number.NEGATIVE_INFINITY
    this.virtualTime = 0
    this.aheadSince = undefined
    this.restarted = false
  }
}
