// The `.replay` value (M2.3 spec §3.2). Tick numbering: a command's `tick` is the sim's tick before its step;
// every other tick here (checks, reference hashes, finalTick) is the sim's tick after a step.

/** The `.replay` format version this build reads and writes. */
export const REPLAY_FORMAT = 1
/** How often, in ticks, a recording stores a check hash when `RecorderOptions.checkEvery` is not given. */
export const DEFAULT_CHECK_EVERY = 60
/**
 * The longest run a replay may hold: 2^24 ticks, over 77 hours at 60 Hz. Bounds the work a small forged file can
 * ask of playback (its final delta is one varint).
 */
export const REPLAY_MAX_TICKS: number = 16_777_216

/**
 * A command as a replay stores it: the sim's `Command` without its tick, which the replay's `ticks` entry
 * carries.
 */
export interface ReplayCommand {
  readonly source: number
  readonly seq: number
  readonly type: string
  readonly payload: unknown
}

/**
 * The facts a replay needs before it plays: tick rate, seed, the schema and content hashes it was recorded
 * against, where it starts and how often it checks.
 */
export interface ReplayHeader {
  readonly tickHz: number
  readonly seed: number
  /** 16 hex digits, copied from the start snapshot's header. */
  readonly schemaHash: string
  readonly contentHash: string
  readonly startTick: number
  readonly checkEvery: number
  /** SIM_VERSION when recorded; informational, never compared. */
  readonly framework: string
  /** Free-form (game, build id); always {} in a golden. */
  readonly meta: Readonly<Record<string, string>>
}

/**
 * A recorded run: its header, the start snapshot, the accepted commands by tick, check hashes along the way
 * and the final tick and hash. Replaying it must reproduce every hash.
 */
export interface Replay {
  readonly header: ReplayHeader
  /** sim.snapshot() when recording started: covers setup spawns and checkpoint starts. */
  readonly start: Uint8Array
  /** Only ticks with accepted commands, ascending; commands within a tick in (source, seq) order. */
  readonly ticks: ReadonlyArray<{ readonly tick: number; readonly commands: readonly ReplayCommand[] }>
  /** sim.hash() after stepping to `tick`; ascending, in (startTick, finalTick]. */
  readonly checks: ReadonlyArray<{ readonly tick: number; readonly hash: string }>
  readonly finalTick: number
  readonly finalHash: string
  /** Goldens only: a hash after every step, and full snapshots every `snapshotEvery` ticks. */
  readonly reference?: {
    /** Index i is the hash at startTick + 1 + i. */
    readonly hashes: readonly string[]
    readonly snapshots: ReadonlyArray<{ readonly tick: number; readonly bytes: Uint8Array }>
  }
}
