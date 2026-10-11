import { expect, test } from 'vitest'
import { xxhash64Reference } from '../testing/xxhash64-reference'
import { xxhash64 } from './xxhash64'

// A fixed xorshift stream, so the inputs are the same on every run.
function bytes(n: number, seed: number): Uint8Array {
  let x = seed >>> 0 || 1
  const out = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    x ^= x << 13
    x ^= x >>> 17
    x ^= x << 5
    out[i] = x & 255
  }
  return out
}

test('agrees with the BigInt reference for every length 0..300 and assorted seeds', () => {
  const seeds = [0n, 1n, 0x9e3779b1n, 0xffffffffffffffffn, 0x8000000000000000n]
  for (let n = 0; n <= 300; n++) {
    const data = bytes(n, n + 7)
    const seed = seeds[n % seeds.length] as bigint
    expect(xxhash64(data, seed)).toBe(xxhash64Reference(data, seed))
  }
})

test('agrees on a subarray view with a non-zero byte offset', () => {
  const data = bytes(1000, 3).subarray(13, 913)
  expect(xxhash64(data)).toBe(xxhash64Reference(data))
})

// The sim's lib has no DOM types; performance exists in Node and every browser the tests run in.
const { performance } = globalThis as unknown as { performance: { now(): number } }

test('is at least 2x faster than the BigInt reference on 256 KB (best of 5 each)', () => {
  const data = bytes(256 * 1024, 11)
  const best = (f: () => void) => {
    let min = Number.POSITIVE_INFINITY
    for (let i = 0; i < 5; i++) {
      const t = performance.now()
      f()
      min = Math.min(min, performance.now() - t)
    }
    return min
  }
  const fast = best(() => xxhash64(data))
  const slow = best(() => xxhash64Reference(data))
  expect(slow / fast).toBeGreaterThan(2) // measured about 2.8x in Node 24 (17 vs 6 ms per MB)
})
