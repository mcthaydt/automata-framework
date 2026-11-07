import { describe, expect, it } from 'vitest'
import { summarize } from '#src/stats.ts'

describe('summarize (ms per frame)', () => {
  it('reports nearest-rank percentiles, the mean and the max', () => {
    const samples = Array.from({ length: 100 }, (_, index) => 100 - index) // 100..1, unsorted on purpose
    expect(summarize(samples)).toEqual({ count: 100, mean: 50.5, p50: 50, p95: 95, p99: 99, max: 100 })
  })

  it('takes the sample itself when there is one', () => {
    expect(summarize([7.25])).toEqual({ count: 1, mean: 7.25, p50: 7.25, p95: 7.25, p99: 7.25, max: 7.25 })
  })

  it('gives NaN, never 0, for an empty sample, so an empty run cannot pass a budget', () => {
    const stats = summarize([])
    expect(stats.count).toBe(0)
    for (const value of [stats.mean, stats.p50, stats.p95, stats.p99, stats.max]) expect(value).toBeNaN()
  })
})
