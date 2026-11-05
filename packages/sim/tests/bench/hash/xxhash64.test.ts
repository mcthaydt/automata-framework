import { expect, test } from 'vitest'
import { xxhash64 } from '#src/features/hash/xxhash64.ts'
import { xxhash64Reference } from '#src/testing/xxhash64-reference.ts'

// A timing, so it runs in the bench project (`pnpm bench`), not the gate: under parallel load the ratio
// dropped to 1.70x. Correctness against the reference is gated in xxhash64-equivalence.test.ts.

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

// The sim's lib has no DOM types; performance exists in Node and every browser the tests run in.
const { performance } = globalThis as unknown as { performance: { now(): number } }

test('is at least 2x faster than the BigInt reference on 256 KB (best of 20 each, after warming up)', () => {
  const data = bytes(256 * 1024, 11)
  // Warm both up first: in a file of its own, nothing has run them through the JIT yet, and cold runs
  // measured 1.6x.
  for (let i = 0; i < 20; i++) {
    xxhash64(data)
    xxhash64Reference(data)
  }
  const best = (f: () => void) => {
    let min = Number.POSITIVE_INFINITY
    for (let i = 0; i < 20; i++) {
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
