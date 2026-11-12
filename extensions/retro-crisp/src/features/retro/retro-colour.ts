// The retro pass's colour maths on the CPU: the grade, the fade and the ordered dither, as the shader does them. Pure, so
// Node can prove the neutral profile changes nothing and the clinic's numbers move what they should.

import type { RetroGrade, RetroProfile } from './retro-profile.schema.ts'
import { smoothstep } from './smoothstep.ts'

export type Rgb = readonly [number, number, number]

const luma = ([r, g, b]: Rgb): number => 0.2126 * r + 0.7152 * g + 0.0722 * b
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v))
const mix = (a: number, b: number, t: number): number => a * (1 - t) + b * t

/** The grade, step for step as the shader runs it. Input and output are 0 to 1. */
export function applyGrade(grade: RetroGrade, colour: Rgb): [number, number, number] {
  const base = colour
  const gain = 2 ** grade.exposure
  let [r, g, b] = [colour[0] * gain, colour[1] * gain, colour[2] * gain]
  r += grade.warmth * 0.1 - grade.tint * 0.05
  b -= grade.warmth * 0.1 + grade.tint * 0.05
  g += grade.tint * 0.1
  const lift = (1 - luma([r, g, b])) * grade.brilliance * 0.5
  r += lift
  g += lift
  b += lift
  r = (r - 0.5) * grade.contrast + 0.5
  g = (g - 0.5) * grade.contrast + 0.5
  b = (b - 0.5) * grade.contrast + 0.5
  const l = clamp01(luma([r, g, b]))
  const highlight = smoothstep(0.5, 1, l)
  const shadow = 1 - smoothstep(0, 0.5, l)
  const shift = highlight * grade.highlights * 0.5 + shadow * grade.shadows * 0.5
  r = clamp01(r + shift)
  g = clamp01(g + shift)
  b = clamp01(b + shift)
  const grey = luma([r, g, b])
  r = mix(grey, r, grade.saturation)
  g = mix(grey, g, grade.saturation)
  b = mix(grey, b, grade.saturation)
  const top = Math.max(r, g, b)
  const bottom = Math.min(r, g, b)
  const vibrance = grade.vibrance * (1 - (top - bottom) / (top + 0.001))
  const vivid = luma([r, g, b])
  r = clamp01(mix(vivid, r, 1 + vibrance))
  g = clamp01(mix(vivid, g, 1 + vibrance))
  b = clamp01(mix(vivid, b, 1 + vibrance))
  const finalLuma = luma([r, g, b])
  if (finalLuma < grade.blackCrush) [r, g, b] = [finalLuma, finalLuma, finalLuma]
  return [
    mix(base[0], r, grade.moodBlend),
    mix(base[1], g, grade.moodBlend),
    mix(base[2], b, grade.moodBlend),
  ]
}

const channels = (hex: string): [number, number, number] => [
  ((Number.parseInt(hex.slice(1), 16) >> 16) & 255) / 255,
  ((Number.parseInt(hex.slice(1), 16) >> 8) & 255) / 255,
  (Number.parseInt(hex.slice(1), 16) & 255) / 255,
]

/** The fade's black point: the fade colour times `lift`. */
export const fadeBlack = (profile: RetroProfile): [number, number, number] =>
  channels(profile.fade.colour).map((c) => c * profile.fade.lift) as [number, number, number]

/**
 * A colour through the pass, without its time-driven parts (grain, dust and the scratch, which need a pixel and a frame):
 * the grade, the vignette at the frame's centre (none) and the fade's lift and white.
 */
export function retroColour(profile: RetroProfile, colour: Rgb): [number, number, number] {
  const graded = applyGrade(profile.grade, colour)
  const black = fadeBlack(profile)
  return [0, 1, 2].map((i) => mix(black[i] as number, profile.fade.white, clamp01(graded[i] as number))) as [
    number,
    number,
    number,
  ]
}

/** The 8 x 8 ordered Bayer matrix entry for a pixel, from the bits of x XOR y and of y (the shaders compute it the same way). */
export function bayer8(x: number, y: number): number {
  const a = (x ^ y) & 7
  const b = y & 7
  let v = 0
  for (let i = 0; i < 3; i++) v = (v << 2) | (((a >> i) & 1) << 1) | ((b >> i) & 1)
  return v
}

/** The dither threshold weighted by luma, and tapered to nothing in deep black so the shadows do not crawl. */
export function lumaWeightedThreshold(threshold: number, lumaValue: number, weight: number): number {
  return threshold * (1 - lumaValue * weight) * smoothstep(0.02, 0.08, lumaValue)
}
