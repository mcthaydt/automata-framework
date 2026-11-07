/**
 * What this client's netcode is doing, measured (FloorFifty's `net-diagnostics.ts`; M7 spec §4.2).
 *
 * The room is drawn from three moving parts that each fail quietly: a clock that tracks authority, a buffer that interpolates the
 * others, and a prediction that carries the local player ahead. When one is off the symptom is a feel ("floaty", "rubber-bandy")
 * and a feel cannot be bisected, so each part reports numbers. It observes and never steers: nothing in the session reads a value
 * back out of it except `degraded`, which only changes what the connection badge says. Anomalies go to a console sink only while
 * one is attached, each kind at most once a second.
 *
 * `degraded` (new here): the round trip's median over the last five probes, or the silence since the last snapshot, past the
 * thresholds (1000 ms by default); it clears once both are under 80 % of them. Plain counters and a ring of recent values, no Effect
 * per frame (ADR 0003).
 */

export interface DistributionSummary {
  readonly count: number
  readonly last: number
  readonly min: number
  readonly p50: number
  readonly p95: number
  readonly max: number
}

/** The last `capacity` values, summarised on demand. */
export class Distribution {
  private values: number[] = []
  constructor(private readonly capacity = 120) {}

  add(value: number): void {
    this.values.push(value)
    if (this.values.length > this.capacity) this.values.shift()
  }

  summary(): DistributionSummary {
    const n = this.values.length
    if (n === 0) return { count: 0, last: 0, min: 0, p50: 0, p95: 0, max: 0 }
    const sorted = [...this.values].sort((a, b) => a - b)
    const at = (f: number): number => sorted[Math.min(n - 1, Math.max(0, Math.ceil(f * n) - 1))] as number
    return {
      count: n,
      last: this.values[n - 1] as number,
      min: sorted[0] as number,
      p50: at(0.5),
      p95: at(0.95),
      max: sorted[n - 1] as number,
    }
  }

  /** The median of the last `n` values; undefined with fewer than `n`. */
  medianOfLast(n: number): number | undefined {
    if (this.values.length < n) return undefined
    const sorted = this.values.slice(-n).sort((a, b) => a - b)
    return sorted[Math.floor(n / 2)]
  }

  clear(): void {
    this.values = []
  }
}

export interface DegradedThresholds {
  readonly roundTripMs: number
  readonly gapMs: number
}
export const DEFAULT_DEGRADED: DegradedThresholds = { roundTripMs: 1000, gapMs: 1000 }
/** A degraded link clears when it is under this fraction of both thresholds. */
const RECOVER = 0.8
/** Round trips the median is taken over. */
const RTT_WINDOW = 5
/** A correction past this many ticks is worth a console line. */
const CORRECTION_ANOMALY_TICKS = 4

export interface NetSummary {
  readonly snapshots: {
    readonly count: number
    /** Same tick as the newest already seen: a republish, harmless. */
    readonly duplicates: number
    /** Older than the newest already seen: the transport reordered. */
    readonly reordered: number
    readonly intervalMs: DistributionSummary
    readonly tickStep: DistributionSummary
  }
  readonly clock: {
    readonly errorTicks: DistributionSummary
    readonly snaps: number
    /** How far behind authority everyone else is drawn, now. */
    readonly delayTicks: number
  }
  readonly buffer: {
    readonly headroomTicks: DistributionSummary
    readonly underruns: number
    readonly frames: number
  }
  readonly corrections: {
    readonly count: number
    readonly adopted: number
    readonly size: DistributionSummary
  }
  readonly input: { readonly lateCommands: number; readonly rttMs: DistributionSummary }
  readonly wire: { readonly bytesIn: number; readonly bytesPerSecond: number }
  readonly degraded: boolean
}

export interface NetDiagnosticsOptions {
  /** Milliseconds (Effect's `Clock` in the session). */
  readonly now: () => number
  readonly thresholds?: DegradedThresholds | undefined
  /** Called when `degraded` changes. */
  readonly onDegraded?: ((degraded: boolean) => void) | undefined
}

export class NetDiagnostics {
  private readonly thresholds: DegradedThresholds
  private sink: ((line: string) => void) | undefined
  private readonly lastLogged = new Map<string, number>()
  private isDegraded = false

  private snapshotCount = 0
  private duplicates = 0
  private reordered = 0
  private newestTick: number | undefined
  private lastArrival: number | undefined
  private readonly interval = new Distribution()
  private readonly tickStep = new Distribution()
  private readonly clockError = new Distribution()
  private snapCount = 0
  private delay = 0
  private readonly headroom = new Distribution()
  private underrunCount = 0
  private frameCount = 0
  private correctionCount = 0
  private adoptedCount = 0
  private readonly correctionSize = new Distribution()
  private late = 0
  private readonly rtt = new Distribution()
  private bytesIn = 0
  private firstBytes: { at: number; total: number } | undefined

  constructor(private readonly options: NetDiagnosticsOptions) {
    this.thresholds = options.thresholds ?? DEFAULT_DEGRADED
  }

  /** Attaches or detaches the console sink. Only anomalies are ever logged. */
  attach(sink: ((line: string) => void) | undefined): void {
    this.sink = sink
  }

  get degraded(): boolean {
    return this.isDegraded
  }

  /** A snapshot arrived for `tick`. */
  snapshot(tick: number): void {
    const at = this.options.now()
    this.snapshotCount += 1
    if (this.lastArrival !== undefined) this.interval.add(at - this.lastArrival)
    this.lastArrival = at
    if (this.newestTick !== undefined) {
      if (tick === this.newestTick) this.duplicates += 1
      else if (tick < this.newestTick) this.reordered += 1
      else this.tickStep.add(tick - this.newestTick)
    }
    this.newestTick = Math.max(tick, this.newestTick ?? tick)
    this.evaluate()
  }

  /** The clock after a frame: how far it trails its anchor, how far back others are drawn, how many times it jumped. */
  clock(report: { error: number; delayTicks: number; snaps: number }): void {
    this.clockError.add(report.error)
    this.delay = report.delayTicks
    if (report.snaps > this.snapCount) this.anomaly('clock', `the clock jumped (${report.snaps} so far)`)
    this.snapCount = report.snaps
  }

  /** How far the buffer reaches past the render moment; an underrun is none at all. */
  buffer(headroomTicks: number): void {
    this.frameCount += 1
    this.headroom.add(headroomTicks)
    if (headroomTicks < 0) {
      this.underrunCount += 1
      this.anomaly('underrun', `the buffer ran dry by ${(-headroomTicks).toFixed(1)} ticks`)
    }
  }

  /** A reconciliation moved the predicted state by `ticks` of error; `adopted` when it was taken outright rather than eased. */
  correction(ticks: number, adopted: boolean): void {
    this.correctionCount += 1
    if (adopted) this.adoptedCount += 1
    this.correctionSize.add(ticks)
    if (ticks > CORRECTION_ANOMALY_TICKS)
      this.anomaly('correction', `a correction of ${ticks.toFixed(1)}${adopted ? ' (adopted)' : ''}`)
  }

  /** A command was resent late. */
  lateCommand(): void {
    this.late += 1
    this.anomaly('late', 'a command was resent late')
  }

  /** A pong measured a round trip. */
  roundTrip(ms: number): void {
    this.rtt.add(ms)
    this.evaluate()
  }

  /** The socket's lifetime received byte count, as the transport reports it. */
  bytes(total: number): void {
    this.bytesIn = total
    this.firstBytes ??= { at: this.options.now(), total }
  }

  /** Re-reads the silence since the last snapshot; the session calls it each frame. */
  poll(): void {
    this.evaluate()
  }

  private evaluate(): void {
    const { roundTripMs, gapMs } = this.thresholds
    const median = this.rtt.medianOfLast(RTT_WINDOW)
    const silence = this.lastArrival === undefined ? 0 : this.options.now() - this.lastArrival
    const over = (median ?? 0) > roundTripMs || silence > gapMs
    const under = (median ?? 0) <= roundTripMs * RECOVER && silence <= gapMs * RECOVER
    const next = this.isDegraded ? !under : over
    if (next === this.isDegraded) return
    this.isDegraded = next
    this.options.onDegraded?.(next)
  }

  private anomaly(kind: string, line: string): void {
    if (this.sink === undefined) return
    const at = this.options.now()
    const last = this.lastLogged.get(kind)
    if (last !== undefined && at - last < 1000) return
    this.lastLogged.set(kind, at)
    this.sink(`[net] ${kind}: ${line}`)
  }

  summary(): NetSummary {
    const first = this.firstBytes
    const seconds = first === undefined ? 0 : (this.options.now() - first.at) / 1000
    return {
      snapshots: {
        count: this.snapshotCount,
        duplicates: this.duplicates,
        reordered: this.reordered,
        intervalMs: this.interval.summary(),
        tickStep: this.tickStep.summary(),
      },
      clock: { errorTicks: this.clockError.summary(), snaps: this.snapCount, delayTicks: this.delay },
      buffer: {
        headroomTicks: this.headroom.summary(),
        underruns: this.underrunCount,
        frames: this.frameCount,
      },
      corrections: {
        count: this.correctionCount,
        adopted: this.adoptedCount,
        size: this.correctionSize.summary(),
      },
      input: { lateCommands: this.late, rttMs: this.rtt.summary() },
      wire: {
        bytesIn: this.bytesIn,
        bytesPerSecond: first === undefined || seconds <= 0 ? 0 : (this.bytesIn - first.total) / seconds,
      },
      degraded: this.isDegraded,
    }
  }

  /** Forgets everything, as leaving a room does. */
  reset(): void {
    this.snapshotCount = 0
    this.duplicates = 0
    this.reordered = 0
    this.newestTick = undefined
    this.lastArrival = undefined
    for (const d of [
      this.interval,
      this.tickStep,
      this.clockError,
      this.headroom,
      this.correctionSize,
      this.rtt,
    ])
      d.clear()
    this.snapCount =
      this.underrunCount =
      this.frameCount =
      this.correctionCount =
      this.adoptedCount =
      this.late =
        0
    this.delay = 0
    this.bytesIn = 0
    this.firstBytes = undefined
    this.lastLogged.clear()
    if (this.isDegraded) {
      this.isDegraded = false
      this.options.onDegraded?.(false)
    }
  }
}
