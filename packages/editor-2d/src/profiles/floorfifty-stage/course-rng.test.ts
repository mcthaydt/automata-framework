import { describe, expect, it } from 'vitest'
import { createRng, deriveSeed } from './course-rng'
import { courseGoldens } from './testing/goldens'

// The integer generator the game and its server share (FloorFifty `packages/shared/src/level/rng.ts`, SplitMix32): a
// course is a function of its seed, so the stream must be the game's, bit for bit.

const goldens = courseGoldens()

describe('createRng', () => {
  it.each(goldens.streams)('gives the game’s first four values for seed $seed', ({ seed, uint32 }) => {
    const rng = createRng(seed)
    expect(uint32.map(() => rng.nextUint32())).toEqual(uint32)
  })

  it('gives one stream for one seed, and a seed past 32 bits is read as its low 32 bits', () => {
    const first = createRng(12345)
    const again = createRng(12345)
    const wrapped = createRng(2 ** 32 + 12345)
    for (let i = 0; i < 20; i++) {
      const value = first.nextUint32()
      expect(again.nextUint32()).toBe(value)
      expect(wrapped.nextUint32()).toBe(value)
    }
  })

  it('reads a negative seed as the unsigned number with the same bits', () => {
    const negative = createRng(-7)
    const unsigned = createRng(2 ** 32 - 7)
    expect(negative.nextUint32()).toBe(unsigned.nextUint32())
  })

  it('draws whole numbers below 2^32', () => {
    const rng = createRng(99)
    for (let i = 0; i < 500; i++) {
      const value = rng.nextUint32()
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(2 ** 32)
    }
  })

  it('draws floats from 0 up to but not including 1, as the raw value over 2^32', () => {
    const floats = createRng(7)
    const raw = createRng(7)
    for (let i = 0; i < 500; i++) {
      const value = floats.nextFloat()
      expect(value).toBe(raw.nextUint32() / 2 ** 32)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('draws integers from min to max, both included', () => {
    const rng = createRng(3)
    const seen = new Set<number>()
    for (let i = 0; i < 400; i++) seen.add(rng.nextInt(-3, 3))
    expect([...seen].sort((a, b) => a - b)).toEqual([-3, -2, -1, 0, 1, 2, 3])
  })

  it('returns min when min and max are equal, and still uses up a draw', () => {
    const rng = createRng(5)
    const control = createRng(5)
    expect(rng.nextInt(4, 4)).toBe(4)
    control.nextUint32()
    expect(rng.nextUint32()).toBe(control.nextUint32())
  })

  it('draws ranges from min up to but not including max', () => {
    const rng = createRng(11)
    const control = createRng(11)
    for (let i = 0; i < 500; i++) {
      const value = rng.nextRange(10, 20)
      expect(value).toBe(10 + control.nextFloat() * 10)
      expect(value).toBeGreaterThanOrEqual(10)
      expect(value).toBeLessThan(20)
    }
  })
})

describe('deriveSeed', () => {
  it.each(goldens.derived)('gives the game’s seed and first draws for ($seed, $salt)', (golden) => {
    const derived = deriveSeed(golden.seed, golden.salt)
    expect(derived).toBe(golden.derived)
    const rng = createRng(derived)
    expect(golden.uint32.map(() => rng.nextUint32())).toEqual(golden.uint32)
    expect(rng.nextFloat()).toBe(golden.float)
    expect(rng.nextInt(-3, 3)).toBe(golden.int)
    expect(rng.nextRange(10, 20)).toBe(golden.range)
  })

  it('gives another seed to another salt, so every floor has a stream of its own', () => {
    const seeds = new Set([0, 1, 2, 3, 4, 5, 6, 7].map((salt) => deriveSeed(35229, salt)))
    expect(seeds.size).toBe(8)
  })

  it('gives an unsigned 32-bit seed', () => {
    for (const salt of [0, 1, 17, 99]) {
      const seed = deriveSeed(2 ** 31 + salt, salt)
      expect(Number.isInteger(seed)).toBe(true)
      expect(seed).toBeGreaterThanOrEqual(0)
      expect(seed).toBeLessThan(2 ** 32)
    }
  })
})
