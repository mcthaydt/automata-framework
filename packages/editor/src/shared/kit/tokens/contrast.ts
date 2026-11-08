// WCAG contrast between two CSS colours, for tests that read what the page really draws (`getComputedStyle` answers in
// `rgb(…)`) and for the token tests (which read `#rrggbb`).

function channel(value: number): number {
  const s = value / 255
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

/** The red, green and blue (0 to 255) of `#rrggbb` or `rgb(r, g, b)` / `rgba(r, g, b, a)`; anything else throws. */
function channels(color: string): [number, number, number] {
  const text = color.trim()
  if (/^#[0-9a-f]{6}$/i.test(text)) {
    const n = Number.parseInt(text.slice(1), 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const match = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(text)
  if (match === null) throw new Error(`contrast: cannot read the colour "${color}"`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

/** WCAG relative luminance of a colour. */
function luminance(color: string): number {
  const [r, g, b] = channels(color)
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** The WCAG contrast ratio of two colours, 1 to 21. */
export function contrastRatio(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a)
  return ((light as number) + 0.05) / ((dark as number) + 0.05)
}
