import { describe, expect, it } from 'vitest'
import { fill, newRaster } from '#src/entries/testing.ts'
import { downscale, LANDMARKS, measureTurnaround, specNumbers } from '../../../scripts/figure-reference.ts'

const WHITE = [255, 255, 255, 255] as const
const SKIN = [200, 120, 90, 255] as const

/** A white picture of a stick figure 100 rows tall: a column body from row 10 down to row 109 and two legs under row 60. */
function stick() {
  const r = newRaster(600, 140)
  fill(r, 0, 0, 600, 140, WHITE)
  fill(r, 270, 10, 60, 50, SKIN)
  fill(r, 270, 60, 25, 50, SKIN)
  fill(r, 305, 60, 25, 50, SKIN)
  return r
}

describe('the reference board', () => {
  it('averages an area when it makes a picture smaller', () => {
    const r = newRaster(2, 2)
    fill(r, 0, 0, 1, 2, [0, 0, 0, 255])
    fill(r, 1, 0, 1, 2, [200, 100, 50, 255])
    expect([...downscale(r, 0.5).data]).toEqual([100, 50, 25, 255])
  })

  it('finds the top, the floor and the crotch in the picture, and the widths at them', () => {
    const m = measureTurnaround(stick())
    expect(m.top).toBe(10)
    expect(m.floor).toBe(109)
    expect(m.crotch).toBe(59)
    expect(m.figureCentre).toBe(300)
  })

  it('says its numbers as shares of the figure and in heads', () => {
    const lines = specNumbers(measureTurnaround(stick())).join('\n')
    expect(lines).toContain('100 rows tall (top 10, floor 109)')
    expect(lines).toContain('crotch to the floor (legs): 50 rows, 50.0 %')
    expect(LANDMARKS.chin).toBeGreaterThan(LANDMARKS.eyes)
  })
})
