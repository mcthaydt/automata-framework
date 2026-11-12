/**
 * The last bit of the maths library, moved on purpose, for the drawing tests of the figure painter and the character kit.
 *
 * `Math.sin` and `Math.cos` may differ from one machine to the next in their last bit (a library built with fused
 * multiply-add gives the Macs' answer, not x64's). A painter that is right gives the same cell either way, and a Linux x64
 * run has no other arch to try, so this wraps the functions and moves each result one unit in the last place, by a seeded
 * generator, for the length of one run.
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

/** The double one unit in the last place from `x`, toward +Infinity (`dir` 1) or -Infinity (`dir` -1). */
export function step(x: number, dir: 1 | -1): number {
  f64[0] = x
  // A positive double's bit pattern grows with its value; a negative one's shrinks.
  u64[0] = (u64[0] ?? 0n) + (x > 0 === dir > 0 ? 1n : -1n)
  return f64[0] ?? x
}

type MathFn = (...args: number[]) => number

/**
 * Runs `run` with `Math.sin`, `cos`, `tan`, `atan2`, `atan`, `asin`, `acos`, `exp`, `log`, `log2`, `pow` and `cbrt` each
 * returning its true value a last bit up (a quarter of calls), down (a quarter) or unchanged, chosen by a 32-bit LCG seeded
 * with `seed`. Zero and non-finite results pass through. `seed` 0 nudges nothing. The functions come back in a `finally`.
 */
export function nudged<T>(seed: number, run: () => T): T {
  if (seed === 0) return run()
  const math = Math as unknown as Record<string, MathFn>
  const original = new Map<string, MathFn>()
  let s = seed >>> 0
  for (const name of NAMES) {
    const fn = math[name] as MathFn
    original.set(name, fn)
    math[name] = (...args: number[]) => {
      const value = fn(...args)
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0
      const pick = s >>> 30 // the top two bits: 0 up, 1 down, 2 and 3 unchanged
      if (value === 0 || !Number.isFinite(value) || pick > 1) return value
      return step(value, pick === 0 ? 1 : -1)
    }
  }
  try {
    return run()
  } finally {
    for (const [name, fn] of original) math[name] = fn
  }
}
