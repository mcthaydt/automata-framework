// A waistcoat: a short cloth vest over the chest, open at the front, its colour the torso's waist.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/garments.ts at a1f7246 (`dress`'s waistcoat
// branch), with AF's strict types; the formulas are the source's.

import type { Garment } from '@automata/3d/figures'
import { box, type Dressing, GROUP, J } from '@automata/3d/figures-kit'
import { z } from 'zod'
import { type KitGarment, swatch } from './kit-garment.ts'

export interface Waistcoat {
  readonly waistcoat: string
}

function wear(d: Dressing, item: Garment): void {
  const { waistcoat } = item as Waistcoat
  const { m, s, r, parts } = d
  const g = s.genes
  const k = m.k
  const chestFront = 0.1 * k * m.thick * m.depth
  r.waist = waistcoat
  parts.push(
    box(J.chest, waistcoat, GROUP.torso, {
      at: [0, 0.035 * k, 0],
      r: [g.shoulders * 0.96 * m.chest, 0.13 * k, chestFront * 1.18],
      taper: [0.94, 0.92],
      e: [0.72, 0.6],
      keep: (x, y, z) => y < 0.62 && !(z > 0.45 && y > 0.05 && Math.abs(x) < 0.3),
    }),
  )
}

export const WAISTCOAT: KitGarment = {
  name: 'waistcoat',
  kind: { schema: z.strictObject({ waistcoat: swatch }), swatches: {}, wear },
}
