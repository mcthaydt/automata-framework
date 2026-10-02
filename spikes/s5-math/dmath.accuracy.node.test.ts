import { expect, test } from 'vitest'
import { mulberry32 } from '../shared/prng'
import { atan, atan2, cos, exp, log, pow, sin, tan } from './dmath'

function maxErr(f: (r: () => number) => [number, number], n = 200_000, rel = false): number {
  const rand = mulberry32(7)
  let worst = 0
  for (let i = 0; i < n; i++) {
    const [got, want] = f(rand)
    const e = rel ? Math.abs((got - want) / want) : Math.abs(got - want)
    if (e > worst) worst = e
  }
  return worst
}

test('accuracy bounds (record the numbers in the verdict)', () => {
  const r = {
    sin: maxErr((q) => {
      const x = q() * 2000 - 1000
      return [sin(x), Math.sin(x)]
    }),
    cos: maxErr((q) => {
      const x = q() * 2000 - 1000
      return [cos(x), Math.cos(x)]
    }),
    tan: maxErr(
      (q) => {
        let x = q() * 2000 - 1000
        while (Math.abs(Math.cos(x)) < 1e-3) x += 0.01
        return [tan(x), Math.tan(x)]
      },
      200_000,
      true,
    ),
    atan2: maxErr((q) => {
      const y = q() * 2000 - 1000
      const x = q() * 2000 - 1000
      return [atan2(y, x), Math.atan2(y, x)]
    }),
    exp: maxErr(
      (q) => {
        const x = q() * 1400 - 700
        return [exp(x), Math.exp(x)]
      },
      200_000,
      true,
    ),
    log: maxErr(
      (q) => {
        const x = 10 ** (q() * 600 - 300)
        return [log(x), Math.log(x)]
      },
      200_000,
      true,
    ),
    pow: maxErr(
      (q) => {
        const x = q() * 100 + 1e-9
        const y = q() * 20 - 10
        return [pow(x, y), x ** y]
      },
      200_000,
      true,
    ),
  }
  console.log('[S5] max error', JSON.stringify(r))
  expect(r.sin).toBeLessThan(1e-14)
  expect(r.cos).toBeLessThan(1e-14)
  expect(r.tan).toBeLessThan(1e-12)
  expect(r.atan2).toBeLessThan(1e-14)
  expect(r.exp).toBeLessThan(1e-14)
  expect(r.log).toBeLessThan(1e-14)
  expect(r.pow).toBeLessThan(1e-12)
})

test('edge values and signed zeros match Math.*', () => {
  expect(exp(0)).toBe(1)
  expect(log(1)).toBe(0)
  expect(exp(710)).toBe(Number.POSITIVE_INFINITY)
  expect(exp(-800)).toBe(0)
  expect(log(0)).toBe(Number.NEGATIVE_INFINITY)
  expect(Number.isNaN(log(-1))).toBe(true)
  expect(Math.abs(log(5e-324) - Math.log(5e-324))).toBeLessThan(1e-12)
  expect(Object.is(sin(-0), -0)).toBe(true)
  expect(Object.is(atan(-0), -0)).toBe(true)
  for (const [y, x] of [
    [0, -1],
    [-0, -1],
    [0, 0],
    [-0, 0],
    [0, -0],
    [-0, -0],
    [1, -1],
    [-1, -1],
    [1, 0],
    [-1, 0],
  ] as const) {
    expect(Object.is(atan2(y, x), Math.atan2(y, x)) || Math.abs(atan2(y, x) - Math.atan2(y, x)) < 1e-15).toBe(
      true,
    )
  }
  expect(pow(2, 3)).toBe(8)
  expect(pow(-2, 3)).toBe(-8)
  expect(pow(1.5, 2)).toBe(2.25)
  expect(pow(2, -2)).toBe(0.25)
  expect(Object.is(pow(-0, 3), -0)).toBe(true)
})
