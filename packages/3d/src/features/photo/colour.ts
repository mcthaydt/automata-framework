// The photo pipeline's colour helpers: the DUEL palette index nearest a colour, the ramp's steps and a seeded hash. Colours here
// are `0xRRGGBB` numbers, as the pipeline works on whole images of them.

import { nearestDuel } from '@automata/content/palette'

/** Steps along a DUEL ramp, 0 to 7: palette index = ramp * STEPS + step. */
export const STEPS = 8

const nearest = new Map<number, number>()

/** The palette index of the DUEL colour nearest `rgb`. */
export function duelIndexOf(rgb: number): number {
  let index = nearest.get(rgb)
  if (index === undefined) {
    index = nearestDuel(`#${rgb.toString(16).padStart(6, '0')}`)
    nearest.set(rgb, index)
  }
  return index
}

/** A hash of up to three integers to [0, 1): a tile's wear and where it starts come from it, so a seed repeats. */
export function hash3(a: number, b: number, c = 0): number {
  let n = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1)
  n = Math.imul(n ^ (n >>> 15), 0x85ebca6b)
  n ^= n >>> 13
  return (n >>> 0) / 4294967296
}
