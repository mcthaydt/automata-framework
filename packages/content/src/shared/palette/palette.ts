// The game's palette: content like everything else, so the renderer's palette LUT, the ui theme tokens and
// the pipelines' palette gate all read one checked, hashed source (art direction, docs/art/README.md).
// A game without `content/palette.toml` gets AF's default, DUEL.

import { z } from 'zod'
import type { Problem } from '../diagnostics/diagnostic'
import { DUEL_RAMPS } from './duel'

/** The game's palette: a name and its colors. */
export interface Palette {
  readonly name: string
  /** `#rrggbb`, lowercase, in authored order. */
  readonly colors: readonly string[]
}

export const paletteSchema: z.ZodType<Palette> = z.strictObject({
  name: z.string().min(1),
  colors: z
    .array(z.string().regex(/^#[0-9a-fA-F]{6}$/, 'expected a color like #ff0040'))
    .min(2)
    .max(256),
})

/** The palette a game gets when it has no `content/palette.toml`: DUEL, its ramps row-major (colour `r * 8 + s`). */
export const DEFAULT_PALETTE: Palette = Object.freeze({
  name: 'DUEL',
  colors: Object.freeze(DUEL_RAMPS.flat()),
})

/** Checks an authored palette (already through `paletteSchema`), or returns the default when there is none. */
export function checkPalette(authored: Palette | undefined): { palette: Palette; problems: Problem[] } {
  if (authored === undefined) return { palette: DEFAULT_PALETTE, problems: [] }
  const colors = authored.colors.map((color) => color.toLowerCase())
  const problems: Problem[] = []
  colors.forEach((color, index) => {
    const first = colors.indexOf(color)
    if (first !== index) {
      problems.push({
        path: ['colors', index],
        code: 'invalidPalette',
        message: `color ${index} (${color}) repeats color ${first}`,
      })
    }
  })
  return { palette: { name: authored.name, colors }, problems }
}

/**
 * Reads a paint.net palette file (Lospec's download format): one `AARRGGBB` color per line, `;` comments.
 * Used to check the embedded default against `docs/art/palettes/duel.txt`.
 */
export function parsePaintNetPalette(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line !== '' && !line.startsWith(';'))
    .map((line) => `#${line.slice(2).toLowerCase()}`)
}
