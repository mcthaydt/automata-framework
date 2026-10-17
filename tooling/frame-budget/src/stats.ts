// Summary statistics for one probe run's per-frame samples, in ms.

export interface FrameStats {
  readonly count: number
  readonly mean: number
  readonly p50: number
  readonly p95: number
  readonly p99: number
  readonly max: number
}

/**
 * Nearest-rank percentiles (the smallest sample with at least p% of samples at or below it), so every reported
 * value is a frame that really happened. An empty sample reports NaN rather than 0: the budget check counts NaN as
 * "not measured", so a probe that recorded nothing can never pass.
 */
export function summarize(samples: readonly number[]): FrameStats {
  const sorted = [...samples].sort((a, b) => a - b)
  const rank = (percent: number): number =>
    sorted[Math.ceil((percent / 100) * sorted.length) - 1] ?? Number.NaN
  const total = sorted.reduce((sum, value) => sum + value, 0)
  return {
    count: sorted.length,
    mean: sorted.length === 0 ? Number.NaN : total / sorted.length,
    p50: rank(50),
    p95: rank(95),
    p99: rank(99),
    max: sorted.at(-1) ?? Number.NaN,
  }
}
