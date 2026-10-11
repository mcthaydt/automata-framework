import { describe, expect, it } from 'vitest'
import { type Measurement, overBudget } from './budgets.ts'

// The S8 budgets (docs/spikes/s8-effect.md): E1 Effect's share ≤ 35 kB gzip, E2 Effect adds ≤ 100 ms of boot
// at 4× CPU, E3 the page ≤ 60 kB gzip, E4 boot ≤ 300 ms at 4× CPU. E5 (no CSP violation) fails the
// measurement itself. Medians are per phone profile.

const measured: Measurement = {
  gzip: { effect: 46_670, noEffect: 18_660 },
  bootMedians: [
    { profile: 'Galaxy S9+', effect: 165, noEffect: 99 },
    { profile: 'iPhone 13', effect: 168, noEffect: 95 },
  ],
}

describe('S8 budgets', () => {
  it('passes the numbers measured on 2026-10-11', () => {
    expect(overBudget(measured)).toEqual([])
  })

  it('names each budget a measurement breaks', () => {
    expect(
      overBudget({
        gzip: { effect: 61_000, noEffect: 20_000 },
        bootMedians: [{ profile: 'iPhone 13', effect: 320, noEffect: 210 }],
      }),
    ).toEqual([
      'E1: Effect adds 41.00 kB gzip (budget 35 kB)',
      'E3: the page is 61.00 kB gzip (budget 60 kB)',
      'E2: Effect adds 110 ms of boot on iPhone 13 (budget 100 ms)',
      'E4: boot takes 320 ms on iPhone 13 (budget 300 ms)',
    ])
  })

  it('checks sizes alone when no boot was measured', () => {
    expect(overBudget({ gzip: measured.gzip, bootMedians: [] })).toEqual([])
  })
})
