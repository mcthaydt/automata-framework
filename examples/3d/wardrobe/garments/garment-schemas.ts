// The streetwear garments' item schemas, by name: the shape of one item a figure file names, every swatch field a
// library reference (so a missing swatch is a compile error at its line) and every number bounded a little past what
// the classic library, its builders' defaults and its random wardrobe draw, so any value in range builds a sound
// garment. Out of range they break the build (cargos of width 0 run out of memory). Defaults come from
// `WARDROBE_DEFAULTS`, written in as references.

import { type Garment, withSwatchDefaults } from '@automata/3d/figures-kit'
import { contentRef } from '@automata/content/schema'
import { z } from 'zod'
import { WARDROBE_DEFAULTS } from './defaults.ts'

const swatch = contentRef('figure-swatch')
const optionalSwatch = swatch.optional()
const flag = z.boolean().optional()
const within = (min: number, max: number) => z.number().min(min).max(max)
/** A hanging garment's length: 0 the hip, 0.5 the knee, 1 the ankle. */
const length = within(0, 1)
/** A zip's teeth, top to foot: at least one swatch. */
const zip = z.array(swatch).min(1).optional()

const STREETWEAR: Readonly<Record<string, z.ZodType<Garment>>> = {
  puffer: z.strictObject({
    puffer: swatch,
    trim: optionalSwatch,
    zip: optionalSwatch,
    pull: optionalSwatch,
    length: length.optional(),
    baffles: z.number().int().min(1).max(12).optional(),
  }),
  hoodie: z.strictObject({
    hoodie: swatch,
    rib: optionalSwatch,
    inside: optionalSwatch,
    cords: optionalSwatch,
    aglets: optionalSwatch,
  }),
  tee: z.strictObject({
    tee: swatch,
    rib: optionalSwatch,
    // Its width over the shoulders (1.16 oversized); its length, 0 at the waistband, 1 a hand below the hip.
    fit: within(0.8, 1.6).optional(),
    sleeves: flag,
    length: within(-0.1, 2).optional(),
  }),
  jacket: z.strictObject({ jacket: swatch, zip, hardware: optionalSwatch }),
  bomber: z.strictObject({
    bomber: swatch,
    rib: optionalSwatch,
    zip,
    hardware: optionalSwatch,
    tipping: optionalSwatch,
  }),
  wideLegs: z.strictObject({ wideLegs: swatch, stitch: optionalSwatch, hardware: optionalSwatch }),
  cargos: z.strictObject({
    cargos: swatch,
    hardware: optionalSwatch,
    // Of the era's straight cut.
    width: within(0.5, 1.5).optional(),
    cuff: flag,
    stitch: optionalSwatch,
  }),
  sneakers: z.strictObject({
    sneakers: swatch,
    mudguard: optionalSwatch,
    sole: optionalSwatch,
    outsole: optionalSwatch,
    laces: optionalSwatch,
    court: flag,
    tab: optionalSwatch,
  }),
  // The U's depth on the chest (m at 1.62 m); a hoop's drop, of the head's height (under 0.12 a stud).
  chain: z.strictObject({ chain: swatch, links: optionalSwatch, drop: within(0.02, 0.3).optional() }),
  hoops: z.strictObject({ hoops: swatch, size: within(0.02, 0.5).optional() }),
  shades: z.strictObject({ shades: swatch, frame: optionalSwatch, up: flag }),
}

/** The streetwear garments' item schemas by name, defaults written in; `streetwear-kinds.ts` registers them. */
export const STREETWEAR_SCHEMAS: Readonly<Record<string, z.ZodType<Garment>>> = Object.fromEntries(
  Object.entries(STREETWEAR).map(([key, schema]) => [
    key,
    withSwatchDefaults(schema, WARDROBE_DEFAULTS[key as keyof typeof WARDROBE_DEFAULTS]),
  ]),
)
