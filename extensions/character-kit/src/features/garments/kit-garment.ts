// What a garment file of the kit hands the register: the key its items carry, and how core's registry treats it.
// The shared pieces of its schema are here too, so every garment bounds its numbers the same way.

import type { GarmentKind } from '@automata/3d/figures'
import { contentRef } from '@automata/content/schema'
import { z } from 'zod'

/** A garment of the kit: `name` is the key an item carries (`{ skirt = "navy" }`), `kind` how it is built and checked. */
export interface KitGarment {
  readonly name: string
  readonly kind: GarmentKind
}

/** A library swatch, checked at the line that names it. */
export const swatch = contentRef('figure-swatch')
export const optionalSwatch = swatch.optional()
export const flag = z.boolean().optional()
/**
 * A number bounded a little past what the garments' builders and a random wardrobe use, so any value in range builds a
 * sound garment. Out of range they break the build or the garment (a skirt above the hip).
 */
export const within = (min: number, max: number): z.ZodNumber => z.number().min(min).max(max)
/** A hanging garment's length: 0 the hip, 0.5 the knee, 1 the ankle. */
export const length: z.ZodNumber = within(0, 1)
