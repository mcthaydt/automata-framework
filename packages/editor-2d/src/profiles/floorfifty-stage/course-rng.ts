// The integer stream a course is drawn from (FloorFifty `packages/shared/src/level/rng.ts`, ported for the Course view,
// 2D editor spec §10.5). A course is a function of its seed, so this must equal the game's stream bit for bit: the goldens
// in `testing/course-goldens.json` are written by the game's own file.
//
// SplitMix32: a 32-bit counter advanced by the golden-ratio increment, then avalanched with two xor-shift and multiply
// rounds. A stream seeded from one floor index is as well spread as one read in order.

const GOLDEN_GAMMA = 0x9e3779b9
const MIX_A = 0x85ebca6b
const MIX_B = 0xc2b2ae35
const UINT32_SPAN = 0x100000000

function mix(state: number): number {
  let value = state
  value ^= value >>> 16
  value = Math.imul(value, MIX_A)
  value ^= value >>> 13
  value = Math.imul(value, MIX_B)
  value ^= value >>> 16
  return value >>> 0
}

/**
 * A seed of its own for one salt of a base seed. The generator salts with the floor index, so a floor depends on its
 * index alone and the first `n` floors of a tall course are those of a course of `n` floors.
 */
export function deriveSeed(seed: number, salt: number): number {
  return mix((seed ^ Math.imul(salt + 1, GOLDEN_GAMMA)) >>> 0)
}

export interface Rng {
  /** The next raw 32-bit value. */
  nextUint32(): number
  /** The next value in `[0, 1)`. */
  nextFloat(): number
  /** The next whole number from `min` to `max`, both included. */
  nextInt(min: number, max: number): number
  /** The next value in `[min, max)`. */
  nextRange(min: number, max: number): number
}

/** An independent stream from a 32-bit seed; a larger or negative seed is read as its low 32 bits. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0

  const nextUint32 = (): number => {
    state = (state + GOLDEN_GAMMA) >>> 0
    return mix(state)
  }
  const nextFloat = (): number => nextUint32() / UINT32_SPAN

  return {
    nextUint32,
    nextFloat,
    // A draw is consumed even when `min` equals `max`, so the stream after it is the game's.
    nextInt: (min, max) => min + Math.floor(nextFloat() * (max - min + 1)),
    nextRange: (min, max) => min + nextFloat() * (max - min),
  }
}
