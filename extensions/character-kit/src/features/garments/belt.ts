// A belt: a band round the waist, with a buckle at the front when it names one.
//
// Ported from the figure code this kit grew out of (`dress`'s belt
// branch), with AF's strict types; the formulas are the source's.

import type { Garment } from '@automata/3d/figures'
import { at, box, type Dressing, GROUP, J } from '@automata/3d/figures-kit'
import { z } from 'zod'
import { band } from './hang.ts'
import { type KitGarment, optionalSwatch, swatch } from './kit-garment.ts'

export interface Belt {
  readonly belt: string
  readonly buckle?: string | undefined
}

function wear(d: Dressing, item: Garment): void {
  const { belt, buckle } = item as Belt
  const { m, s, parts } = d
  const k = m.k
  const waistY = s.hipY + 0.14 * k
  parts.push(
    band(belt, GROUP.torso, waistY - 0.005, 0.045 * k, 0.142 * k * m.waist, 0.142 * k * m.waist * 0.8),
  )
  if (buckle)
    parts.push(
      box(J.pelvis, buckle, GROUP.torso, {
        at: [0, waistY - at(s.rest, J.pelvis)[1] - 0.005, 0.118 * k * m.waist],
        r: [0.036 * k, 0.024 * k, 0.012 * k],
        e: [0.3, 0.4],
      }),
    )
}

export const BELT: KitGarment = {
  name: 'belt',
  kind: { schema: z.strictObject({ belt: swatch, buckle: optionalSwatch }), swatches: {}, wear },
}
