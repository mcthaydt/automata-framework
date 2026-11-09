// OKLab and colour distance: the lamp kit's reach, the photo pipeline's tones and the snap. The maths is fdlibm's, so a colour
// is the same bytes in every engine.
import { cbrt, pow } from '@automata/sim/math'

/** `0xRRGGBB` as OKLab `[L, a, b]`. */
export function oklab(rgb: number): [number, number, number] {
  const linear = (channel: number): number => {
    const c = channel / 255
    return c <= 0.04045 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4)
  }
  const [r, g, b] = [linear((rgb >> 16) & 255), linear((rgb >> 8) & 255), linear(rgb & 255)]
  const l = cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** The OKLab distance between two `0xRRGGBB` colours. */
export function labDistance(a: number, b: number): number {
  const [p, q] = [oklab(a), oklab(b)]
  const [dl, da, db] = [p[0] - q[0], p[1] - q[1], p[2] - q[2]]
  return Math.sqrt(dl * dl + da * da + db * db)
}

/** `#rrggbb` as `0xRRGGBB`. */
export const hexToRgb = (hex: string): number => Number.parseInt(hex.slice(1), 16)

const cube = (v: number): number => v * v * v

const gamma = (v: number): number =>
  Math.round(255 * Math.max(0, Math.min(1, v <= 0.0031308 ? 12.92 * v : 1.055 * pow(v, 1 / 2.4) - 0.055)))

/** An OKLab colour back to `0xRRGGBB`, each channel clamped. */
export function rgbFromLab(L: number, A: number, B: number): number {
  const l = cube(L + 0.3963377774 * A + 0.2158037573 * B)
  const m = cube(L - 0.1055613458 * A - 0.0638541728 * B)
  const s = cube(L - 0.0894841775 * A - 1.291485548 * B)
  return (
    (gamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s) << 16) |
    (gamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s) << 8) |
    gamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s)
  )
}
