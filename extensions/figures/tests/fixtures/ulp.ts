/**
 * The last bit of the maths library, moved on purpose.
 *
 * `Math.sin` and `Math.cos` are allowed to differ from one machine to the next in their last bit (a library built with
 * fused multiply-add gives the Macs' answer, not x64's). A painter that is right must give the same cell either way, and
 * x64 has no other arch to run on, so this wraps the functions and moves each result one unit in the last place, by a
 * seeded generator, for the length of one run.
 */
const NAMES = [
  'sin',
  'cos',
  'tan',
  'atan2',
  'atan',
  'asin',
  'acos',
  'exp',
  'log',
  'log2',
  'pow',
  'cbrt',
] as const

const f64 = new Float64Array(1)
const u64 = new BigUint64Array(f64.buffer)

/** The double one unit in the last place from `x`, toward +∞ (`dir` 1) or −∞ (`dir` −1). */
export function step(x: number, dir: 1 | -1): number {
  f64[0] = x
  // For a positive double the bit pattern grows with the value; for a negative one it shrinks.
  u64[0] += x > 0 === dir > 0 ? 1n : -1n
  return f64[0]
}

/**
 * Runs `run` with the maths nudged: each call of `Math.sin`, `cos`, `tan`, `atan2`, `atan`, `asin`, `acos`, `exp`,
 * `log`, `log2`, `pow` and `cbrt` returns its true value a last bit up (a quarter of calls), down (a quarter) or
 * unchanged, chosen by a 32-bit LCG seeded with `seed`. Zero and non-finite results pass through. `seed` 0 nudges nothing.
 * The functions come back in a `finally`.
 */
export function nudged<T>(seed: number, run: () => T): T {
  if (seed === 0) return run()
  const original = new Map<string, (...a: number[]) => number>()
  let s = seed >>> 0
  for (const name of NAMES) {
    const fn = Math[name] as (...a: number[]) => number
    original.set(name, fn)
    ;(Math as unknown as Record<string, unknown>)[name] = (...a: number[]) => {
      const v = fn(...a)
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0
      const pick = s >>> 30 // the top two bits: 0 up, 1 down, 2 and 3 unchanged
      if (v === 0 || !Number.isFinite(v) || pick > 1) return v
      return step(v, pick === 0 ? 1 : -1)
    }
  }
  try {
    return run()
  } finally {
    for (const [name, fn] of original) (Math as unknown as Record<string, unknown>)[name] = fn
  }
}
