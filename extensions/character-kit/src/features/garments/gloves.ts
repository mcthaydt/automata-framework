// Gloves: the hands repainted in the gloves' cloth.

import type { Garment } from '@automata/3d/figures'
import type { Dressing } from '@automata/3d/figures-kit'
import { z } from 'zod'
import { type KitGarment, swatch } from './kit-garment.ts'

export interface Gloves {
  readonly gloves: string
}

function wear(d: Dressing, item: Garment): void {
  d.r.hand = (item as Gloves).gloves
}

export const GLOVES: KitGarment = {
  name: 'gloves',
  kind: { schema: z.strictObject({ gloves: swatch }), swatches: {}, wear },
}
