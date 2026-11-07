// Stockings: the legs repainted from the thigh down.

import type { Garment } from '@automata/3d/figures'
import type { Dressing } from '@automata/3d/figures-kit'
import { z } from 'zod'
import { type KitGarment, swatch } from './kit-garment.ts'

export interface LegWear {
  readonly legs: string
}

function wear(d: Dressing, item: Garment): void {
  d.r.thigh = d.r.knee = d.r.shin = (item as LegWear).legs
}

export const LEGS: KitGarment = {
  name: 'legs',
  kind: { schema: z.strictObject({ legs: swatch }), swatches: {}, wear },
}
