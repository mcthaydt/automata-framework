import { describe, expect, test } from 'vitest'
import { clamp, decimalsOf, nextEnabled, roundTo } from '#src/shared/kit/widgets/widget-math.ts'

describe('clamp', () => {
  test('keeps a value inside the bounds, either of which may be missing', () => {
    expect(clamp(5, 0, 10)).toBe(5)
    expect(clamp(-5, 0, 10)).toBe(0)
    expect(clamp(50, 0, 10)).toBe(10)
    expect(clamp(-5, undefined, 10)).toBe(-5)
    expect(clamp(50, 0, undefined)).toBe(50)
  })
})

describe('decimalsOf and roundTo', () => {
  test('a step has as many decimals as its shortest decimal spelling', () => {
    expect([1, 10, 0.5, 0.1, 0.25, 0.001, 1e-7, 2.5e-3].map(decimalsOf)).toEqual([0, 0, 1, 1, 2, 3, 7, 4])
  })

  test('rounding to the step decimals removes float drift', () => {
    expect(0.1 * 3).not.toBe(0.3)
    expect(roundTo(0.1 * 3, decimalsOf(0.1))).toBe(0.3)
    expect(roundTo(1.005 * 1000, 0)).toBe(1005)
    expect(roundTo(2.675, 2)).toBeCloseTo(2.68, 10)
  })
})

describe('nextEnabled', () => {
  const enabled = [true, false, true, true, false]
  const is = (i: number): boolean => enabled[i] === true

  test('moves to the next enabled index, skipping disabled ones', () => {
    expect(nextEnabled(5, 0, 1, is)).toBe(2)
    expect(nextEnabled(5, 2, 1, is)).toBe(3)
    expect(nextEnabled(5, 3, -1, is)).toBe(2)
    expect(nextEnabled(5, 2, -1, is)).toBe(0)
  })

  test('wraps around the ends', () => {
    expect(nextEnabled(5, 3, 1, is)).toBe(0)
    expect(nextEnabled(5, 0, -1, is)).toBe(3)
  })

  test('does not wrap when asked, and finds nothing when nothing is enabled', () => {
    expect(nextEnabled(5, 3, 1, is, false)).toBeUndefined()
    expect(nextEnabled(5, 0, -1, is, false)).toBeUndefined()
    expect(nextEnabled(3, 0, 1, () => false)).toBeUndefined()
    expect(nextEnabled(0, 0, 1, () => true)).toBeUndefined()
  })

  test('a start of -1 finds the first enabled index forward and the last backward', () => {
    expect(nextEnabled(5, -1, 1, is)).toBe(0)
    expect(nextEnabled(5, -1, -1, is)).toBe(3)
  })
})
