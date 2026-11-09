// A texel's colour, last: its albedo times the light it is in, the haze over it, and the one snap to DUEL with a Bayer
// dither, so a colour between two palette colours lands on both in a pattern and not on one in a flat patch. A figure's
// cell and a tile go through the same functions, so they are lit, hazed and snapped alike. The maths is plain float
// arithmetic with no 8-bit store between the steps, so a texel is the same colour in every engine.

import { duel } from '../math/duel.ts'

type V3 = readonly [number, number, number]

/** The haze: a veil toward `colour`, none before `near` metres past the focus and `amount` of it from `far`, glowing with
 * the light it is in by `glow`. */
export interface Haze {
  /** `#rrggbb`. */
  readonly colour: string
  readonly near: number
  readonly far: number
  readonly amount: number
  readonly glow: number
}

/** A 4×4 Bayer matrix (0 to 15). */
export const BAYER: readonly number[] = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

/** `0xRRGGBB` as three channels, 0 to 1. */
export const rgbChannels = (n: number): V3 => [
  ((n >> 16) & 255) / 255,
  ((n >> 8) & 255) / 255,
  (n & 255) / 255,
]

/** `#rrggbb` as three channels, 0 to 1. */
export const rgb01 = (hex: string): V3 => rgbChannels(Number.parseInt(hex.slice(1), 16))

/** Albedo (`0xRRGGBB`) times light times gain, per channel, in 0 to 1 and clamped to 1. */
export function litColour(albedo: number, light: V3, gain: number): V3 {
  const c = (shift: number, i: 0 | 1 | 2): number =>
    Math.min(1, (((albedo >> shift) & 255) / 255) * light[i] * gain)
  return [c(16, 0), c(8, 1), c(0, 2)]
}

/** The haze's share at a texel `behind` metres past the focus: 0 before `near`, rising linearly to `amount` at `far`. */
export function hazeShare(behind: number, haze: Haze): number {
  return Math.min(1, Math.max(0, (behind - haze.near) / (haze.far - haze.near))) * haze.amount
}

/** A colour hazed: mixed toward the veil, whose colour glows with the texel's light (`colour + glow × light`), by `share`. */
export function hazed(c: V3, light: V3, share: number, haze: Haze): V3 {
  if (share <= 0) return c
  const veil = rgb01(haze.colour)
  const mix = (i: 0 | 1 | 2): number => c[i] + (Math.min(1, veil[i] + haze.glow * light[i]) - c[i]) * share
  return [mix(0), mix(1), mix(2)]
}

/** The one snap: the colour plus the Bayer offset at texel (`x`, `y`) times `strength`, quantised to a byte a channel and
 * taken to its nearest DUEL colour in OKLab. */
export function snapTexel(c: V3, x: number, y: number, strength: number): number {
  const offset = ((BAYER[(x & 3) + ((y & 3) << 2)] ?? 0) / 16 - 0.5) * strength
  const q = (v: number): number => Math.min(255, Math.max(0, Math.round((v + offset) * 255)))
  return duel((q(c[0]) << 16) | (q(c[1]) << 8) | q(c[2]))
}

/** Light comes in steps: its brightest channel snapped to the nearest `step`, its hue kept. */
export function stepLight(c: V3, step: number): V3 {
  const peak = Math.max(c[0], c[1], c[2])
  if (peak <= 0) return c
  const k = (Math.round(peak / step) * step) / peak
  return [c[0] * k, c[1] * k, c[2] * k]
}
