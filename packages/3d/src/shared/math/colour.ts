// Colour distance, for the lamp kit: how far a lamp's own colour may be from its kind's.

/** `0xRRGGBB` as OKLab `[L, a, b]`. */
export function oklab(rgb: number): [number, number, number] {
  const linear = (channel: number): number => {
    const c = channel / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  const [r, g, b] = [linear((rgb >> 16) & 255), linear((rgb >> 8) & 255), linear(rgb & 255)]
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b)
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b)
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b)
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ]
}

/** The OKLab distance between two `0xRRGGBB` colours. */
export function labDistance(a: number, b: number): number {
  const [p, q] = [oklab(a), oklab(b)]
  return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])
}

/** `#rrggbb` as `0xRRGGBB`. */
export const hexToRgb = (hex: string): number => Number.parseInt(hex.slice(1), 16)
