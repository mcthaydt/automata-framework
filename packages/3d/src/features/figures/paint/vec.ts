// Small vector maths for the painter, on the deterministic functions of `@automata/sim/math` where a result decides a
// texel's tone: `Math.hypot` is not the same bits in every engine, a square root and a product are.

/** `x * x`, in place of `x ** 2`, whose rounding an engine may choose. */
export const sq = (x: number): number => x * x

/** The length of a three-vector. */
export const hypot3 = (x: number, y: number, z: number): number => Math.sqrt(x * x + y * y + z * z)

/** The length of a vector of any size. */
export const norm = (v: readonly number[]): number => {
  let sum = 0
  for (const c of v) sum += c * c
  return Math.sqrt(sum)
}

/** `a[i]`, where the index is known to be in range: a miss is a bug in the painter, not a texel to skip. */
export function must<T>(a: ArrayLike<T>, i: number): T {
  const v = a[i]
  if (v === undefined) throw new Error(`painter: no element ${i} of ${a.length}`)
  return v
}
