import { describe, expect, it } from 'vitest'
import { hashCell, hashText, SALT } from './hash'

describe('hashCell', () => {
  it('is murmur3_32 of the four words (key, x, y, salt) under the seed', () => {
    // Computed by an independent python murmur3_32 over the little-endian bytes of the four words, which first
    // reproduced the published vectors ('test' → 0xba6bd213, 'aaaa' under seed 0x9747b28c → 0x5a97808a, '' under
    // seed 1 → 0x514e28b7), so a change of mixer is a visible diff.
    expect(hashCell(0, 0, 0, 0, 0)).toBe(0x8134cdf8)
    expect(hashCell(1, 2, 3, 4, 5)).toBe(0x72ae4458)
    expect(hashCell(0xdeadbeef, 0xfeedface, 17, 255, SALT.variant)).toBe(0x3f4c73ed)
    expect(hashCell(35229, hashText('solid-top'), 47, 31, SALT.chance)).toBe(0xe0f20626)
    expect(hashCell(4294967295, 4294967295, 4294967295, 4294967295, 4294967295)).toBe(0xf2f699fc)
  })

  it('is deterministic and unsigned 32-bit', () => {
    for (let i = 0; i < 200; i++) {
      const h = hashCell(i * 7919, i * 31, i, i * 3, 1)
      expect(h).toBe(hashCell(i * 7919, i * 31, i, i * 3, 1))
      expect(Number.isInteger(h)).toBe(true)
      expect(h).toBeGreaterThanOrEqual(0)
      expect(h).toBeLessThanOrEqual(0xffffffff)
    }
  })

  it('changes with every argument', () => {
    const base = hashCell(10, 20, 30, 40, 1)
    expect(hashCell(11, 20, 30, 40, 1)).not.toBe(base)
    expect(hashCell(10, 21, 30, 40, 1)).not.toBe(base)
    expect(hashCell(10, 20, 31, 40, 1)).not.toBe(base)
    expect(hashCell(10, 20, 30, 41, 1)).not.toBe(base)
    expect(hashCell(10, 20, 30, 40, 2)).not.toBe(base)
  })

  it('spreads a 64 × 64 sweep evenly over four buckets (within 10 % of a quarter)', () => {
    const buckets = [0, 0, 0, 0]
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 64; x++) {
        const bucket = hashCell(99, 5, x, y, SALT.dice) % 4
        buckets[bucket] = (buckets[bucket] ?? 0) + 1
      }
    }
    for (const count of buckets) expect(Math.abs(count - 1024)).toBeLessThan(102)
  })

  it('has three different salts', () => {
    expect(new Set(Object.values(SALT)).size).toBe(3)
  })
})

describe('hashText', () => {
  it('is FNV-1a (32 bit): the standard vectors', () => {
    expect(hashText('')).toBe(0x811c9dc5)
    expect(hashText('a')).toBe(0xe40c292c)
    expect(hashText('foobar')).toBe(0xbf9cf968)
  })

  it('tells different rule ids apart', () => {
    expect(hashText('solid-top')).toBe(0xa2b6ec92)
    expect(hashText('solid-top')).not.toBe(hashText('solid-bottom'))
  })
})
