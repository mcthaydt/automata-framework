import { describe, expect, it } from 'vitest'
import { summaryRows } from '#src/shared/summary-rows.ts'

describe('summaryRows', () => {
  it('flattens nested objects to dotted names with their values', () => {
    expect(summaryRows({ snapshots: { count: 4, reordered: 1 }, degraded: false })).toEqual([
      { name: 'snapshots.count', value: '4' },
      { name: 'snapshots.reordered', value: '1' },
      { name: 'degraded', value: 'false' },
    ])
  })
  it('prints a distribution (count, last, min, p50, p95, max) on one row', () => {
    const d = { count: 10, last: 3.5, min: 1, p50: 3, p95: 4.25, max: 5 }
    expect(summaryRows({ rtt: d })).toEqual([
      { name: 'rtt', value: 'last 3.5 · p50 3 · p95 4.25 · max 5 (10)' },
    ])
  })
  it('rounds long fractions to two places', () => {
    expect(summaryRows({ rate: 1234.56789 })).toEqual([{ name: 'rate', value: '1234.57' }])
  })
  it('shows a value that is not a number, boolean or object as text, and null as a dash', () => {
    expect(summaryRows({ a: 'x', b: null })).toEqual([
      { name: 'a', value: 'x' },
      { name: 'b', value: '—' },
    ])
  })
  it('is empty for something that is not an object', () => {
    expect(summaryRows(undefined)).toEqual([])
  })
})
