// Registers the kit's garments with core's registry when this file loads. The order is the order a figure's garments are
// told apart in, and it comes after core's own seven (a cap's `mark` is the cap's, so core's cap is first).

import { registerGarment } from '@automata/3d/figures'
import { APRON } from './apron.ts'
import { BELT } from './belt.ts'
import { COAT } from './coat.ts'
import { GLOVES } from './gloves.ts'
import type { KitGarment } from './kit-garment.ts'
import { LEGS } from './legs.ts'
import { MARK } from './mark.ts'
import { SKIRT } from './skirt.ts'
import { WAISTCOAT } from './waistcoat.ts'

/** The kit's garments, in registration order. */
export const KIT_GARMENTS: readonly KitGarment[] = [WAISTCOAT, LEGS, SKIRT, APRON, COAT, BELT, GLOVES, MARK]

for (const { name, kind } of KIT_GARMENTS) registerGarment(name, kind)
