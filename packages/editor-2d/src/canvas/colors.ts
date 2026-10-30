// Colours for Pixi (ED2D.4c3b, plan decision 6). The project holds a colour as `#rrggbb` or as a kit token name
// (`layer/entities`); the token's value is the page's CSS custom property `--color-layer-entities`, read through
// `readVar` (in the app, `getComputedStyle(element).getPropertyValue`). Anything that cannot be read draws in a neutral
// grey rather than failing: the Checks report a bad colour, and the canvas only has to stay honest about it.

/** The grey for a colour that is missing or unreadable (the kit's neutral kind colour). */
export const NEUTRAL = 0x8e8c85

export type ColorResolver = (value: string | undefined) => number

const HEX6 = /^#([0-9a-f]{6})$/i
const HEX3 = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i
const TOKEN = /^[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/

function parseHex(text: string): number | undefined {
  const six = HEX6.exec(text)
  if (six !== null) return Number.parseInt(six[1] as string, 16)
  const three = HEX3.exec(text)
  if (three === null) return undefined
  const [, r, g, b] = three as unknown as [string, string, string, string]
  return Number.parseInt(`${r}${r}${g}${g}${b}${b}`, 16)
}

export function createColorResolver(readVar: (name: string) => string): ColorResolver {
  return (value) => {
    if (value === undefined) return NEUTRAL
    if (TOKEN.test(value)) return parseHex(readVar(`--color-${value.replace('/', '-')}`).trim()) ?? NEUTRAL
    return parseHex(value) ?? NEUTRAL
  }
}
