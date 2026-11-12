// The DUEL snap on the CPU, as the post effect does it on the GPU (duel-snap-filter.ts): the colour plus a 4 × 4 Bayer
// offset to its nearest DUEL colour. The tests hold the pass to it, and a texel that is already a DUEL colour stays itself.
import { DEFAULT_PALETTE } from '@automata/content/palette'

/** The 4 × 4 Bayer matrix, 0 to 15, row by row. */
export const BAYER: readonly number[] = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]

const COLOURS: readonly { readonly c: number; readonly v: readonly [number, number, number] }[] =
  DEFAULT_PALETTE.colors.map((hex) => {
    const c = Number.parseInt(hex.slice(1), 16)
    return {
      c,
      v: [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255] as [number, number, number],
    }
  })

/** Squared distance under which a colour is a palette colour (under half a 1/255 step on a channel, as 8-bit holds it). */
export const EXACT: number = 1 / (510 * 510)

/** Options on the dither's amplitude, both off by default (the amplitude is then the strength at every pixel). */
export interface DitherOptions {
  /** The amplitude falls by this share of the pixel's luma (0 to 1): `strength × (1 − lumaWeight × luma)`. The old game's was 0.5. */
  readonly lumaWeight?: number | undefined
  /** No dither in the deep blacks: the amplitude is scaled by `smoothstep(0.02, 0.08, luma)`, so no crawling noise sits in the dark. */
  readonly shadowTaper?: boolean | undefined
}

/** The Rec. 709 luma of a colour, 0 to 1 a channel. */
export const lumaOf = (r: number, g: number, b: number): number => 0.2126 * r + 0.7152 * g + 0.0722 * b

const smoothstep = (low: number, high: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - low) / (high - low)))
  return t * t * (3 - 2 * t)
}

/** The dither's amplitude at a pixel of this luma: the strength, less the luma weight, tapered to nothing in the deep blacks. */
export function ditherAmplitude(luma: number, strength: number, options: DitherOptions): number {
  const weight = 1 - (options.lumaWeight ?? 0) * luma
  const taper = options.shadowTaper === true ? smoothstep(0.02, 0.08, luma) : 1
  return strength * weight * taper
}

/** The DUEL colour nearest `rgb` (0 to 1 a channel) after the Bayer offset at pixel (x, y), as `0xRRGGBB`. */
export function duelSnap(
  rgb: readonly [number, number, number],
  x: number,
  y: number,
  strength: number,
  options: DitherOptions = {},
): number {
  const amplitude = ditherAmplitude(lumaOf(rgb[0], rgb[1], rgb[2]), strength, options)
  const offset = ((BAYER[(x & 3) + ((y & 3) << 2)] as number) / 16 - 0.5) * amplitude
  let best = Number.POSITIVE_INFINITY
  let pick = 0
  for (const { c, v } of COLOURS) {
    // A colour that is already a DUEL colour (a figure's texel) is kept as it is: the palette has near neighbours
    // the dither would otherwise tip it onto.
    if ((v[0] - rgb[0]) ** 2 + (v[1] - rgb[1]) ** 2 + (v[2] - rgb[2]) ** 2 < EXACT) return c
    const e = (v[0] - rgb[0] - offset) ** 2 + (v[1] - rgb[1] - offset) ** 2 + (v[2] - rgb[2] - offset) ** 2
    if (e < best) {
      best = e
      pick = c
    }
  }
  return pick
}
