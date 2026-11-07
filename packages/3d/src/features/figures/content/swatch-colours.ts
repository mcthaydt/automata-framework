// Swatch colours against the game's palette. A swatch names a palette colour by index; whether that index is
// in the game's palette needs the palette and the swatches together, which no single file's schema sees.

import type { Palette } from '@automata/content'
import { type Swatch, swatchColour } from './swatch.schema.ts'

export interface SwatchColourProblem {
  readonly swatch: string
  readonly message: string
}

/** Every swatch whose ramp and step are past the end of `palette`, in swatch id order. */
export function swatchColourProblems(
  swatches: Readonly<Record<string, Pick<Swatch, 'ramp' | 'step'>>>,
  palette: Palette,
): SwatchColourProblem[] {
  const last = palette.colors.length - 1
  return Object.keys(swatches)
    .sort()
    .flatMap((id) => {
      const swatch = swatches[id]
      if (swatch === undefined) return []
      const colour = swatchColour(swatch)
      if (colour <= last) return []
      return [
        {
          swatch: id,
          message: `${swatch.ramp} step ${swatch.step} (colour ${colour}) is not in the palette ${palette.name} (0 to ${last})`,
        },
      ]
    })
}
