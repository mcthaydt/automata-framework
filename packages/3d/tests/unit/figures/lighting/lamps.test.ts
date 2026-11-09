// A lamp as the figures' light reads it (ported from the figure source's lighting): the strength it has at a moment
// (a flicker that drops in quarters, a light style, a level) and the ramp steps it lifts a surface at a point.

import { describe, expect, it } from 'vitest'
import { type FigureLamp, lampSteps, strength, viewToWorld } from '#src/features/figures/lighting/lamps.ts'
import { noise3 } from '#src/shared/math/noise.ts'

const lamp: FigureLamp = { at: [0, 1, 0], color: '#ffbc4e', steps: 3, radius: 2 }
/** The steps `l` lifts a surface at (px, py, pz) facing (nx, ny, nz), at full strength. */
const lifts = (l: FigureLamp, p: [number, number, number], n: [number, number, number] = [0, 1, 0]): number =>
  lampSteps(l, 1, ...p, ...n)

describe('lampSteps', () => {
  it('lifts its full steps at its heart, facing it', () => {
    expect(lifts(lamp, [0, 0.999999, 0], [0, 1, 0])).toBeCloseTo(3, 3)
    // A metre away it is (1 - (1/2)²)² of that, by the falloff.
    expect(lifts(lamp, [0, 0, 0], [0, 1, 0])).toBeCloseTo(3 * 0.75 * 0.75, 9)
  })
  it('falls off to nothing at its radius, smoothly (a ring a step apart is evenly spaced)', () => {
    expect(lifts(lamp, [2, 1, 0])).toBe(0)
    expect(lifts(lamp, [3, 1, 0])).toBe(0)
    const inner = lifts(lamp, [0.5, 1, 0], [-1, 0, 0])
    const outer = lifts(lamp, [1.5, 1, 0], [-1, 0, 0])
    expect(inner).toBeGreaterThan(outer)
    expect(outer).toBeGreaterThan(0)
  })
  it('wraps its Lambert so a floor right under a lamp, and a wall beside it, still catch it', () => {
    expect(lifts(lamp, [0, 0, 0], [1, 0, 0])).toBeGreaterThan(0)
  })
  it('lifts nothing at no strength', () => {
    expect(lampSteps(lamp, 0, 0, 0, 0, 0, 1, 0)).toBe(0)
  })
  it('lights only inside a spot’s cone', () => {
    const spot: FigureLamp = { ...lamp, aim: [0, -1, 0], cone: 30 }
    expect(lifts(spot, [0, 0, 0])).toBeCloseTo(3 * 0.75 * 0.75, 9)
    expect(lifts(spot, [1.2, 1, 0], [-1, 0, 0])).toBe(0)
  })
})

describe('strength', () => {
  it('is 1 for a lamp that does not flicker and has no level or style', () => {
    expect(strength(lamp, 12.34)).toBe(1)
  })
  it('flickers in quarters, held for a frame of a twelfth of a second, the same every time', () => {
    const flicker: FigureLamp = { ...lamp, flicker: 0.8, rate: 6, seed: 3 }
    const seen = new Set<number>()
    for (let i = 0; i < 400; i++) {
      const s = strength(flicker, i / 12)
      expect(s * 4).toBeCloseTo(Math.round(s * 4), 9)
      expect(strength(flicker, i / 12 + 0.04)).toBe(s)
      seen.add(s)
    }
    expect(seen.size).toBeGreaterThan(1)
    expect(Math.min(...seen)).toBeGreaterThanOrEqual(0)
    expect(Math.max(...seen)).toBeLessThanOrEqual(1)
  })
  it('follows a light style: a is dark, m as authored, z double, one letter a tenth of a second, looping', () => {
    const style: FigureLamp = { ...lamp, style: 'amz', styleRate: 10 }
    expect(strength(style, 0.05)).toBe(0)
    expect(strength(style, 0.15)).toBe(1)
    expect(strength(style, 0.25)).toBe(2)
    expect(strength(style, 0.35)).toBe(0)
  })
  it('is scaled by its level, in quarters', () => {
    expect(strength({ ...lamp, level: 0.5 }, 1)).toBe(0.5)
    expect(strength({ ...lamp, level: 0 }, 1)).toBe(0)
  })
})

describe('noise3', () => {
  it('is deterministic, in [0, 1) and smooth across a lattice step', () => {
    expect(noise3(1.3, 2.7, 0.1)).toBe(noise3(1.3, 2.7, 0.1))
    for (let i = 0; i < 100; i++) {
      const v = noise3(i * 0.37, i * 0.11, i * 0.73)
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
    expect(Math.abs(noise3(2.001, 0.5, 0.5) - noise3(1.999, 0.5, 0.5))).toBeLessThan(0.01)
  })
})

describe('viewToWorld', () => {
  it('leaves a view-space direction alone for a level camera and tips it for a pitched one', () => {
    expect(viewToWorld([0, 0, 1], 0)).toEqual([0, 0, 1])
    const [x, y, z] = viewToWorld([0, 0, 1], Math.PI / 6)
    expect([x, y, z]).toEqual([0, expect.closeTo(0.5, 9), expect.closeTo(Math.cos(Math.PI / 6), 9)])
  })
})
