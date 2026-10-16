// How bright a pixel light is at each pixel: a smooth falloff cut into four hard steps, with a 4 × 4 ordered
// (Bayer) dither where one step meets the next. Hard steps and a dither are what keep a light reading as
// pixel art rather than a smooth airbrush at the game's low resolution. Pure, so it is tested without a GPU.

const BAYER_4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
] as const
const STEPS = 4
/** Widens the full-brightness core a little, so the centre is solid light whatever the dither says. */
const CORE_BOOST = 1.15

/** Brightness 0 to 1, in quarters, of the pixel at (x, y) in a light of `radius` pixels centred in its box. */
export function lightLevel(x: number, y: number, radius: number): number {
  const distance = Math.hypot(x + 0.5 - radius, y + 0.5 - radius) / radius
  if (distance >= 1) return 0
  const falloff = 1 - distance
  const smooth = falloff * falloff * (3 - 2 * falloff)
  // Centred thresholds (-0.5 to +0.5) so the centre reaches full brightness and the edge fades to zero.
  const threshold = ((BAYER_4[y % 4]?.[x % 4] ?? 0) + 0.5) / 16 - 0.5
  return Math.min(STEPS, Math.max(0, Math.round(smooth * CORE_BOOST * STEPS + threshold))) / STEPS
}
