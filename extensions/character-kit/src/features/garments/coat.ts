// A coat: a long hanging garment from the shoulders to `length`, over the top and trousers, with a collar and three
// buttons when it names them. It sets the outermost hanging garment (an apron over it clears it) and how far the chest's
// front stands out.
//
// Ported from the figure code this kit grew out of (`dress`'s coat
// branch), with AF's strict types; the formulas are the source's.

import type { Garment } from '@automata/3d/figures'
import { axisAngle, box, type Dressing, GROUP, hemAt, J, SIDES } from '@automata/3d/figures-kit'
import { z } from 'zod'
import { hang } from './hang.ts'
import { type KitGarment, length, optionalSwatch, swatch } from './kit-garment.ts'

export interface Coat {
  readonly coat: string
  readonly length: number
  readonly buttons?: string | undefined
  readonly collar?: string | undefined
}

function wear(d: Dressing, item: Garment): void {
  const { coat, length, buttons, collar } = item as Coat
  const { m, s, r, parts, decals } = d
  const k = m.k
  const waistY = s.hipY + 0.14 * k
  const chestFront = 0.1 * k * m.thick * m.depth
  r.chest = r.waist = r.shoulder = r.upper = r.fore = r.pelvis = coat
  const bottom = hemAt(s, length)
  if (length > 0.45) d.thighs = false
  parts.push(
    hang(coat, GROUP.skirt, waistY, bottom, {
      waist: 0.15 * k * m.waist,
      hem: 0.21 * k,
      follow: 0.7,
      folds: [5, 0.04],
    }),
  )
  d.outer = { waist: 0.15 * k * m.waist, hem: 0.21 * k }
  d.front = chestFront * 1.04
  if (collar)
    parts.push(
      ...SIDES.map(([, x]) =>
        box(J.chest, collar, GROUP.torso, {
          at: [x * 0.055 * k, 0.12 * k, chestFront * 0.9],
          r: [0.03 * k, 0.07 * k, 0.014 * k],
          turn: axisAngle([0, 0, 1], -x * 0.35),
          e: [0.35, 0.45],
        }),
      ),
    )
  if (buttons)
    for (let i = 0; i < 3; i++)
      decals.push({
        bone: J.chest,
        at: [0, (0.06 - i * 0.07) * k, chestFront + 0.008],
        normal: [0, 0, 1],
        material: buttons,
      })
}

export const COAT: KitGarment = {
  name: 'coat',
  kind: {
    schema: z.strictObject({ coat: swatch, length, buttons: optionalSwatch, collar: optionalSwatch }),
    swatches: {},
    wear,
  },
}
