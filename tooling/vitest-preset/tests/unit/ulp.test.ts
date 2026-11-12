import { describe, expect, it } from 'vitest'
import { nudged, step } from '#src/ulp.ts'

// The last-bit nudge the painter's and the character kit's drawing tests share: a figure that is right draws the same
// cell when the maths library is a last bit off, as it is on another machine.

describe('step', () => {
  it('moves a double one unit in the last place, up or down, for either sign', () => {
    expect(step(1, 1)).toBe(1 + Number.EPSILON)
    expect(step(1, -1)).toBe(1 - Number.EPSILON / 2)
    expect(step(-1, 1)).toBe(-(1 - Number.EPSILON / 2))
    expect(step(-1, -1)).toBe(-(1 + Number.EPSILON))
  })
})

describe('nudged', () => {
  it('changes some results of the maths by a last bit only, and puts the maths back', () => {
    const before = Math.sin
    const plain = Array.from({ length: 64 }, (_, i) => Math.sin(i + 0.5))
    const moved = nudged(1, () => Array.from({ length: 64 }, (_, i) => Math.sin(i + 0.5)))
    expect(Math.sin).toBe(before)
    expect(moved).not.toEqual(plain)
    for (const [i, value] of moved.entries())
      expect(Math.abs(value - (plain[i] as number)), `sin ${i}`).toBeLessThanOrEqual(
        Number.EPSILON * Math.max(1, Math.abs(value)),
      )
  })

  it('puts the maths back when the run throws, and seed 0 nudges nothing', () => {
    const before = Math.cos
    expect(() =>
      nudged(1, () => {
        throw new Error('stop')
      }),
    ).toThrow('stop')
    expect(Math.cos).toBe(before)
    expect(nudged(0, () => Math.cos(2))).toBe(Math.cos(2))
  })
})
