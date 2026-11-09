// The photo pipeline's colour helpers: OKLab back to sRGB (core's `oklab` goes the other way), and the DUEL palette index nearest a colour. Colours here
// are `0xRRGGBB` numbers, as the pipeline works on whole images of them.

import { nearestDuel } from '@automata/content/palette'

const gamma = (v: number): number =>
  Math.round(255 * Math.max(0, Math.min(1, v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055)))

/** An OKLab colour back to `0xRRGGBB`, each channel clamped. */
export function rgbFromLab(L: number, A: number, B: number): number {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3
  return (
    (gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s) << 16) |
    (gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s) << 8) |
    gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  )
}

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
