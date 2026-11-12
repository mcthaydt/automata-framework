// Whole-pixel maths, pure: where the field sits on the screen, and how a billboard's texels land on field pixels.

import type { CrispProfile } from './crisp-profile.schema.ts'

/**
 * A whole number of device pixels per field pixel, the picture centred and the rest black:
 *
 * - `r` is how many device pixels the window has per field pixel if the picture were stretched to it.
 * - The scale `k` is `r` rounded down when that still fills 80% of the window's tighter side (a black border beats a
 *   coarser picture), and up otherwise (the picture then fills the window and the field is smaller than `cap`).
 * - The field follows the window's shape up to `cap`.
 *
 * `resolution` is what a renderer resizes with (field pixels per CSS px), `cssScale` the CSS px per field pixel, `size`
 * the canvas in CSS px and `offset` where it sits in the view. Every device length is a whole number of device pixels.
 */
export function letterboxScale(width: number, height: number, dpr: number, cap: CrispProfile['cap']) {
  const ratio = dpr > 0 ? dpr : 1
  const wd = Math.max(1, Math.floor(width * ratio))
  const hd = Math.max(1, Math.floor(height * ratio))
  const r = Math.max(wd / cap.width, hd / cap.height)
  const k = Math.max(1, Math.floor(r) >= 0.8 * r ? Math.floor(r) : Math.ceil(r))
  const frame: [number, number] = [
    Math.max(1, Math.min(cap.width, Math.floor(wd / k))),
    Math.max(1, Math.min(cap.height, Math.floor(hd / k))),
  ]
  const shown = [frame[0] * k, frame[1] * k] as const
  return {
    resolution: ratio / k,
    cssScale: k / ratio,
    scale: k,
    frame,
    size: [shown[0] / ratio, shown[1] / ratio] as [number, number],
    offset: [Math.floor((wd - shown[0]) / 2) / ratio, Math.floor((hd - shown[1]) / 2) / ratio] as [
      number,
      number,
    ],
  }
}

export type CrispLayout = ReturnType<typeof letterboxScale>

/** Field pixels per texel for a billboard `depth` metres in front of the camera, a texel being `texel` metres. */
export function texelRatio(depth: number, fov: number, frameHeight: number, texel: number): number {
  return depth > 0 ? (frameHeight / (2 * depth * Math.tan(fov / 2))) * texel : 0
}

/**
 * The whole number of field pixels a texel is drawn at: the nearest whole number to `ratio` in proportion (1.63 is 2,
 * 1.35 is 1), so the figure's size changes by at most the square root of (1 + 1 / the whole part of `ratio`). Null when a
 * texel is under a pixel (a figure that far away loses texels to point sampling whatever its scale, so it is left alone).
 */
export function snapRatio(ratio: number): number | null {
  if (!(ratio >= 1)) return null
  const k = Math.floor(ratio)
  return ratio * ratio > k * (k + 1) ? k + 1 : k
}

/**
 * The factor on a billboard's size that gives its texels a whole number of field pixels, or 1 when it is left alone.
 * `depth` is how far in front of the camera the sprite's anchor is, `pitchY` the camera's forward axis in y (the quad's
 * centre sits `(anchorY - 0.5)` of its height above the anchor, which moves it in depth as the size changes), `rows` its
 * height in texels, `texel` its metres per texel before the factor, `fov` the vertical field of view in radians and
 * `frameHeight` the field's height in pixels. The quad faces the camera, so every texel of it is at the centre's depth
 * and the scale is exact.
 */
export function figureSnap(o: {
  depth: number
  pitchY: number
  anchorY: number
  rows: number
  texel: number
  fov: number
  frameHeight: number
}): number {
  const K = o.frameHeight / (2 * Math.tan(o.fov / 2))
  const c = (o.anchorY - 0.5) * o.rows * o.texel * o.pitchY
  const k = snapRatio(texelRatio(o.depth + c, o.fov, o.frameHeight, o.texel))
  if (!k) return 1
  const denominator = o.texel * K - k * c
  return denominator > 0 ? (k * o.depth) / denominator : 1
}
