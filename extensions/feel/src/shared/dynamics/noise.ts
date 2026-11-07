// Hashed noise: a stable pseudo-random number in [0, 1) from
// integers, with no state, so a frame is a pure function of the events and the tick and a replay shakes the same.
/**
 * A steady pseudo-random number from 0 up to but not including 1, made from whole numbers with no
 * stored state, so a replay shakes the same.
 */
export function hash(...n: number[]): number {
  let h = 0x9e3779b9
  for (const v of n) {
    h = Math.imul(h ^ (v | 0), 0x85ebca6b)
    h ^= h >>> 13
    h = Math.imul(h, 0xc2b2ae35)
    h ^= h >>> 16
  }
  return (h >>> 0) / 4294967296
}
