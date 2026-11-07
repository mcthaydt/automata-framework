// Trauma shake (M6.1a step 3), from the arcade source's cases: a 0-to-1 budget that moments add to and time drains, the shake
// its square; the noise a hash of integers, so a replay shakes the same. The offset is whole pixels, capped by the limit.
import { describe, expect, it } from 'vitest'
import { hash } from './noise'
import { Trauma } from './trauma'

describe('hash', () => {
  it('is a stable number in [0, 1) from integers, and differs with them', () => {
    expect(hash(1, 2, 3)).toBe(hash(1, 2, 3))
    expect(hash(1, 2, 3)).not.toBe(hash(1, 2, 4))
    for (let i = 0; i < 200; i += 1) {
      const h = hash(7, i)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThan(1)
    }
  })
})

describe('Trauma', () => {
  it('rests still at zero', () => {
    expect(new Trauma().offset(4, 3, 1)).toEqual([0, 0])
  })
  it('adds up, never past one, and never below zero', () => {
    const trauma = new Trauma()
    trauma.add(0.35)
    trauma.add(0.35)
    expect(trauma.level).toBeCloseTo(0.7, 6)
    trauma.add(0.6)
    expect(trauma.level).toBe(1)
    trauma.add(-5)
    expect(trauma.level).toBe(1)
  })
  it('drains at its rate and stops at zero', () => {
    const trauma = new Trauma()
    trauma.add(0.8)
    trauma.update(0.25, 1.6)
    expect(trauma.level).toBeCloseTo(0.4, 6)
    trauma.update(10, 1.6)
    expect(trauma.level).toBe(0)
  })
  it('shakes by its square, in whole pixels, never past the limit', () => {
    const peak = (level: number): number => {
      const t = new Trauma()
      t.add(level)
      let most = 0
      for (let step = 0; step < 400; step += 1) {
        const [x, y] = t.offset(8, 1, step)
        expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true)
        most = Math.max(most, Math.abs(x), Math.abs(y))
      }
      return most
    }
    expect(peak(1)).toBeLessThanOrEqual(8)
    expect(peak(1)).toBeGreaterThanOrEqual(7)
    expect(peak(0.5)).toBeLessThanOrEqual(2)
  })
  it('is the same shake for the same moment: deterministic, never random', () => {
    const a = new Trauma()
    const b = new Trauma()
    a.add(0.6)
    b.add(0.6)
    expect(a.offset(3, 7, 42)).toEqual(b.offset(3, 7, 42))
    expect(a.offset(3, 7, 42)).not.toEqual(a.offset(3, 8, 42))
  })
  it('moves x and y differently, so it reads as a shake and not a slide', () => {
    const t = new Trauma()
    t.add(1)
    const differs = Array.from({ length: 20 }, (_, step) => t.offset(8, 1, step)).some(([x, y]) => x !== y)
    expect(differs).toBe(true)
  })
  it('settles at once', () => {
    const t = new Trauma()
    t.add(1)
    t.settle()
    expect(t.level).toBe(0)
  })
})
