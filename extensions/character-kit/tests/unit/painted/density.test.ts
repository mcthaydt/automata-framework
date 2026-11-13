// What density a painted figure needs for the zoom it is drawn at, and when it changes its mind. `densityFor` (the painter's) picks
// the density a zoom needs, up to 4; the kit lets a game raise the cap to 8, and adds the one thing a moving camera needs on top of
// it: a zoom that sits on a boundary (a dolly through 4, a hand-held shake about 6) must not flip the figure between two paints.
import { describe, expect, it } from 'vitest'
import { densityChooser, densityNeeded } from '#src/features/painted/density.ts'
import { densityFor } from '#src/shared/figures/door.ts'

const ZOOMS = [0.5, 1, 1.43, 1.9, 2, 2.3, 2.7, 3, 3.9, 4, 4.5, 5.5, 6, 7.9, 8, 9.5, 12, 16, 24]

describe('the density a zoom needs', () => {
  it('is the painter’s own `densityFor` while the cap is 4 or less', () => {
    for (const zoom of ZOOMS)
      for (const max of [1, 2, 4] as const) {
        expect(densityNeeded(zoom, max), `zoom ${zoom}, cap ${max}`).toBe(densityFor(zoom, max))
      }
  })

  it('goes on to 8 when the cap allows it: a whole zoom that 8 divides, else the largest level the zoom reaches', () => {
    expect(densityNeeded(8, 8)).toBe(8)
    expect(densityNeeded(16, 8)).toBe(8)
    expect(densityNeeded(7.9, 8)).toBe(4)
    expect(densityNeeded(9.5, 8)).toBe(8)
    expect(densityNeeded(12, 8)).toBe(4)
    expect(densityNeeded(8, 4)).toBe(4)
  })

  it('is never under 1, and a zoom that is not a number is 1', () => {
    expect(densityNeeded(0.2, 8)).toBe(1)
    expect(densityNeeded(-3, 8)).toBe(1)
    expect(densityNeeded(Number.NaN, 8)).toBe(1)
  })
})

describe('the density a figure keeps, from the zooms it has been drawn at', () => {
  it('is the need of the first zoom it sees', () => {
    for (const zoom of ZOOMS)
      expect(densityChooser(8).pick(zoom), `zoom ${zoom}`).toBe(densityNeeded(zoom, 8))
  })

  it('holds its choice while the zoom stays within 5% of where it was made', () => {
    const chooser = densityChooser()
    expect(chooser.pick(4.05)).toBe(4)
    // Under 4 the painter’s rule says 2; the chooser stays at 4 until the zoom has really moved.
    for (const zoom of [3.99, 3.95, 4.1, 3.9, 4.0]) expect(chooser.pick(zoom), `zoom ${zoom}`).toBe(4)
  })

  it('does not flicker when the zoom shivers across a boundary', () => {
    for (const boundary of [2, 4, 6, 8]) {
      const chooser = densityChooser(8)
      const seen: number[] = []
      for (let i = 0; i < 200; i++) seen.push(chooser.pick(boundary * (1 + (i % 2 === 0 ? -0.01 : 0.01))))
      expect(new Set(seen).size, `boundary ${boundary}`).toBe(1)
    }
  })

  it('does not flicker as a camera dollies in and out through every boundary, once the zoom has really moved', () => {
    const chooser = densityChooser(8)
    const levels: number[] = []
    for (let zoom = 1; zoom <= 12; zoom *= 1.001) levels.push(chooser.pick(zoom))
    for (let zoom = 12; zoom >= 1; zoom /= 1.001) levels.push(chooser.pick(zoom))
    // A zoom is decided afresh only after it has moved 5%, so no level is held for less than that move: 5% is 49 steps of 0.1%.
    let run = 1
    const runs: number[] = []
    for (let i = 1; i < levels.length; i++) {
      if (levels[i] === levels[i - 1]) run++
      else {
        runs.push(run)
        run = 1
      }
    }
    expect(Math.min(...runs)).toBeGreaterThanOrEqual(40)
    expect(new Set(levels)).toEqual(new Set([1, 2, 4, 8]))
  })

  it('goes to the new level once the zoom has moved well away, and back', () => {
    const chooser = densityChooser()
    expect(chooser.pick(4)).toBe(4)
    expect(chooser.pick(1.4)).toBe(1)
    expect(chooser.pick(4)).toBe(4)
  })

  it('never goes above the cap, and a cap of 1 pins to 1', () => {
    expect(densityChooser(2).pick(8)).toBe(2)
    expect(densityChooser(1).pick(8)).toBe(1)
  })
})
