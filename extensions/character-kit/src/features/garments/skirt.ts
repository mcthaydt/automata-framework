// A skirt hanging from the waist to `length` (0 the hip, 0.5 the knee, 1 the ankle), flaring and folded, with a hem band
// in its own cloth when it names one.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/garments.ts at a1f7246 (`dress`'s skirt
// branch), with AF's strict types; the formulas are the source's. Cut: the skirt's stain (a painter wash).

import type { Garment } from '@automata/3d/figures'
import { type Dressing, GROUP, hemAt } from '@automata/3d/figures-kit'
import { z } from 'zod'
import { hang } from './hang.ts'
import { type KitGarment, length, optionalSwatch, swatch, within } from './kit-garment.ts'

export interface Skirt {
  readonly skirt: string
  readonly length: number
  readonly flare?: number | undefined
  readonly folds?: number | undefined
  readonly hem?: string | undefined
}

function wear(d: Dressing, item: Garment): void {
  const skirt = item as Skirt
  const { m, s, r, parts } = d
  const k = m.k
  const waistY = s.hipY + 0.14 * k
  const bottom = hemAt(s, skirt.length)
  if (skirt.length > 0.3) d.thighs = false
  // Under a skirt the hips are the skirt's: nothing of the body shows through where it pokes out.
  r.pelvis = skirt.skirt
  const flare = (0.16 + 0.1 * (skirt.flare ?? 0.4)) * k
  parts.push(
    hang(skirt.skirt, GROUP.skirt, waistY, bottom, {
      waist: 0.138 * k * m.waist,
      hem: flare,
      follow: 0.75,
      folds: [7, skirt.folds ?? 0.06],
    }),
  )
  if (skirt.hem)
    parts.push(
      hang(skirt.hem, GROUP.skirt, bottom + 0.035 * k, bottom - 0.02 * k, {
        waist: flare * 0.985,
        hem: flare * 1.02,
        follow: 0.75,
        belly: 0,
        folds: [7, skirt.folds ?? 0.06],
      }),
    )
}

export const SKIRT: KitGarment = {
  name: 'skirt',
  kind: {
    schema: z.strictObject({
      skirt: swatch,
      length,
      flare: within(0, 2).optional(),
      folds: within(0, 0.3).optional(),
      hem: optionalSwatch,
    }),
    swatches: {},
    wear,
  },
}
