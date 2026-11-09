// A watch or a badge on the chest, on one side.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/garments.ts at a1f7246 (`dress`'s mark
// branch), with AF's strict types; the formulas are the source's.

import type { Garment } from '@automata/3d/figures'
import { type Dressing, J } from '@automata/3d/figures-kit'
import { z } from 'zod'
import { type KitGarment, swatch } from './kit-garment.ts'

export interface Mark {
  readonly mark: 'watch' | 'badge'
  readonly colour: string
  readonly side: 'L' | 'R'
}

function wear(d: Dressing, item: Garment): void {
  const { mark, colour, side } = item as Mark
  const k = d.m.k
  const x = side === 'L' ? 1 : -1
  d.decals.push(
    mark === 'watch'
      ? {
          bone: J.chest,
          at: [x * 0.055 * k, 0.09 * k, d.front],
          normal: [0, 0, 1],
          material: colour,
          size: [1, 2],
        }
      : {
          bone: J.chest,
          at: [x * 0.06 * k, 0.1 * k, d.front],
          normal: [0, 0, 1],
          material: colour,
          size: [2, 1],
        },
  )
}

// A cap's own `mark` is the cap's: the registry tells the two apart by registration order, and the kit registers after
// core's cap.
export const MARK: KitGarment = {
  name: 'mark',
  kind: {
    schema: z.strictObject({
      mark: z.enum(['watch', 'badge']),
      colour: swatch,
      side: z.enum(['L', 'R']),
    }),
    swatches: {},
    wear,
  },
}
