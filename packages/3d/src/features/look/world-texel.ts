// A world texel on the CPU: the rule the tile material's shader follows, so a test can hold the shader to it. A texel's
// albedo is lit (times its light and the look's gain), hazed by how far past the focus it is, and snapped once to DUEL
// through a Bayer dither. `store8` rounds each channel to a byte before the snap, as the 8-bit scene target the shader writes
// to does; the unrounded rule is the one the source measured.

import { hazed, litColour, snapTexel } from '../../shared/render/texel.ts'
import type { Look } from './look.schema.ts'

type V3 = readonly [number, number, number]

const byte = (v: number): number => Math.round(v * 255) / 255

/** The DUEL colour a texel of `albedo` (`0xRRGGBB`) in `light` ends as at pixel (`x`, `y`), the haze at `share` over it. */
export function worldTexel(
  albedo: number,
  light: V3,
  share: number,
  x: number,
  y: number,
  look: Look,
  store8: boolean,
): number {
  const c = hazed(litColour(albedo, light, look.light.gain), light, share, look.haze)
  const stored: V3 = store8 ? [byte(c[0]), byte(c[1]), byte(c[2])] : c
  return snapTexel(stored, x, y, look.dither.strength)
}
