import { describe, expect, it } from 'vitest'
import { easeAt } from './ease.ts'

/** CSS's cubic-bezier at x, by plain bisection on the curve's x: a slow reference for the solver. */
function reference(x1: number, y1: number, x2: number, y2: number, x: number): number {
  const at = (p1: number, p2: number, s: number): number =>
    3 * (1 - s) * (1 - s) * s * p1 + 3 * (1 - s) * s * s * p2 + s * s * s
  let lo = 0
  let hi = 1
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (at(x1, x2, mid) < x) lo = mid
    else hi = mid
  }
  return at(y1, y2, (lo + hi) / 2)
}

const SAMPLES = [0.05, 0.2, 0.37, 0.5, 0.63, 0.8, 0.95]

describe('easeAt', () => {
  it('starts at 0 and ends at 1 for every ease but step, which ends at 1 only at the end', () => {
    for (const ease of ['linear', 'in', 'out', 'inOut', [0.3, 1.4, 0.6, 1]] as const) {
      expect(easeAt(ease, 0)).toBe(0)
      expect(easeAt(ease, 1)).toBe(1)
    }
    expect(easeAt('step', 0)).toBe(0)
    expect(easeAt('step', 0.999)).toBe(0)
    expect(easeAt('step', 1)).toBe(1)
  })
  it('is the identity when linear or left out', () => {
    for (const u of SAMPLES) {
      expect(easeAt('linear', u)).toBe(u)
      expect(easeAt(undefined, u)).toBe(u)
    }
  })
  it("matches CSS's ease-in, ease-out and ease-in-out", () => {
    const curves = { in: [0.42, 0, 1, 1], out: [0, 0, 0.58, 1], inOut: [0.42, 0, 0.58, 1] } as const
    for (const [name, [x1, y1, x2, y2]] of Object.entries(curves))
      for (const u of SAMPLES)
        expect(easeAt(name as keyof typeof curves, u)).toBeCloseTo(reference(x1, y1, x2, y2, u), 9)
  })
  it('follows a Bézier that overshoots', () => {
    const peak = Math.max(...SAMPLES.map((u) => easeAt([0.3, 1.6, 0.6, 1], u)))
    expect(peak).toBeGreaterThan(1)
    for (const u of SAMPLES)
      expect(easeAt([0.3, 1.6, 0.6, 1], u)).toBeCloseTo(reference(0.3, 1.6, 0.6, 1, u), 9)
  })
  it('solves a curve whose x is flat in the middle as closely as doubles allow', () => {
    // [1, 0, 0, 1] in u = s − 0.5 is exactly x = 0.5 + 4u³, y = 0.5 + 1.5u − 2u³. Near u = 0 rounding in x leaves
    // s uncertain by about 5e-6, so y is good to about 1e-5; stopping the bisection on x's error (1e-12) instead
    // left s about 6e-5 and y about 1e-4 off.
    const exact = (x: number): number => {
      const u = Math.cbrt((x - 0.5) / 4)
      return 0.5 + 1.5 * u - 2 * u * u * u
    }
    for (const x of [0.5, 0.5 + 1e-9, 0.5 - 1e-7, 0.5 + 3e-6, 0.5001, 0.25, 0.9])
      expect(Math.abs(easeAt([1, 0, 0, 1], x) - exact(x)), `x ${x}`).toBeLessThan(1e-5)
  })
  it('clamps u to 0..1', () => {
    expect(easeAt('inOut', -0.5)).toBe(0)
    expect(easeAt('inOut', 1.5)).toBe(1)
  })
})
