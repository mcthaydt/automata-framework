/** WCAG 2.x contrast of two colours, each a `#rrggbb` or an `rgb(r g b / a)`; the second is the background. */

type Rgb = readonly [number, number, number]

function parse(color: string): { rgb: Rgb; alpha: number } {
  const hex = /^#([0-9a-f]{6})$/.exec(color)
  if (hex !== null) {
    const n = Number.parseInt(hex[1] as string, 16)
    return { rgb: [(n >> 16) & 255, (n >> 8) & 255, n & 255], alpha: 1 }
  }
  const fn = /^rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)$/.exec(color)
  if (fn !== null) {
    return {
      rgb: [Number(fn[1]), Number(fn[2]), Number(fn[3])],
      alpha: fn[4] === undefined ? 1 : Number(fn[4]),
    }
  }
  throw new Error(`not a colour: ${color}`)
}

function channel(value: number): number {
  const s = value / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function luminance([r, g, b]: Rgb): number {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** The ratio, 1 to 21. A translucent `a` is laid over `b` first, as the browser draws it; `b` must be opaque. */
export function contrast(a: string, b: string): number {
  const back = parse(b).rgb
  const front = parse(a)
  const over = front.rgb.map(
    (c, i) => c * front.alpha + (back[i] as number) * (1 - front.alpha),
  ) as unknown as Rgb
  const [light, dark] = [luminance(over), luminance(back)].sort((x, y) => y - x)
  return ((light as number) + 0.05) / ((dark as number) + 0.05)
}
