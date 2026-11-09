import { describe, expect, it } from 'vitest'
import { viewDensity } from '#src/features/figures/cells/density.ts'

/** The Owner's lens: a metre across at a metre's distance on the short side. */
const LENS = 2 * Math.atan(0.5)
const FIGURES = { min: 1, max: 3 }

describe('the density a view gives a figure', () => {
  it('takes it from the view', () => {
    expect(viewDensity(360, 5, LENS, FIGURES)).toBe(2)
    expect(viewDensity(360, 7, LENS, FIGURES)).toBe(1.5)
    expect(viewDensity(360, 3, LENS, FIGURES)).toBe(3)
    expect(viewDensity(180, 5, LENS, FIGURES)).toBe(1)
  })
  it('rounds to the nearest quarter, not the nearest half', () => {
    // 360 px at 5.8 m is 1.68 sheet densities: 1.75 by quarters, 1.5 by halves.
    expect(viewDensity(360, 5.8, LENS, FIGURES)).toBe(1.75)
  })
  it('keeps to the bounds, in quarter steps', () => {
    expect(viewDensity(360, 0.5, LENS, FIGURES)).toBe(3)
    expect(viewDensity(360, 50, LENS, FIGURES)).toBe(1)
    for (const d of [2, 3.3, 4.1, 5.9, 8, 11]) expect((viewDensity(360, d, LENS, FIGURES) * 4) % 1).toBe(0)
  })
})
