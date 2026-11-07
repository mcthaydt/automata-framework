// A built figure's material as the colour the view draws (materials name palette
// colours). The figures package records a tone step (`shade`) instead of FigureBuilder's DUEL ramp tones; the view
// draws a step as the palette colour a fixed share lighter or darker.
import type { BuiltMaterial } from '../figure/materials.ts'

/** How much one tone step lightens (or, negative, darkens) each channel. */
const SHADE_STEP = 0.18

/** `material`'s palette colour (the palette as `#rrggbb` strings) as 0xRRGGBB, with its shade applied. */
export function materialColour(material: BuiltMaterial, palette: readonly string[]): number {
  const hex = palette[material.colour]
  if (hex === undefined)
    throw new RangeError(`no palette colour ${material.colour} (${palette.length} colours)`)
  const rgb = Number.parseInt(hex.slice(1), 16)
  const k = 1 + SHADE_STEP * (material.shade ?? 0)
  const channel = (shift: number) => Math.min(255, Math.round(((rgb >> shift) & 0xff) * k))
  return (channel(16) << 16) | (channel(8) << 8) | channel(0)
}
