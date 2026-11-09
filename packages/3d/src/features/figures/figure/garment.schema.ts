// Garments: what an outfit is made of. Each
// garment is an object named by its first key (`coat`, `top`, `cape`…), whose value is its cloth's swatch.
// Every swatch field is a library reference, so a missing swatch is a compile error at its line (F-e). The 7
// garments Wick and the base pair wear are typed here; the rest of a wardrobe (apron, belt, coat, gloves, legs, mark,
// skirt, waistcoat) is @automata/character-kit's, and an extension's wardrobe types and registers its own
// (`registerGarment`). Left out: the drawn face's colours (the eyes' `white` and `lips`).

import { contentRef } from '@automata/content/schema'
import { z } from 'zod'
import { type HairStyle, hairStyleSchema } from '../content/hair.schema.ts'
import { type Headwear, headwearSchema, type Lock, lockSchema } from '../content/headwear.schema.ts'
import { keyedUnion } from '../content/keyed-union.ts'
import { refOrInline } from '../content/ref-or-inline.ts'
import { side } from '../content/shapes.schema.ts'
import { GARMENTS } from '../registry/garment-registry.ts'
import { GARMENT_DEFAULTS } from './garment-defaults.ts'

// ─── garments.ts ───
/** A shirt or a dress's body: it repaints the torso and as much of the arms as its sleeves cover. */
export interface Top {
  readonly top: string
  readonly sleeves?: 'none' | 'short' | 'long' | undefined
  readonly cuffs?: string | undefined
  readonly collar?: string | undefined
}
export interface Trousers {
  readonly trousers: string
}
export interface Shoes {
  readonly shoes: string
  readonly sole?: string | undefined
  readonly boots?: boolean | undefined
}
export interface Cape {
  readonly cape: string
  readonly length?: number | undefined
  readonly trim?: string | undefined
}
/**
 * Hair in a swatch's colour: a style from the hair library (or written inline: a style, or its locks), or,
 * with no style, the figure's own `hairPieces`. `tie` the band a pony or a bun is tied
 * with; left out, the outfit's own metal, else the hair's own.
 */
export interface HairGarment {
  readonly hair: string
  readonly style?: string | HairStyle | readonly Lock[] | undefined
  readonly tie?: string | undefined
}
export interface CapGarment {
  readonly cap: string
  readonly style: string | Headwear
  readonly mark?: string | undefined
}
/**
 * The face's marks: the eyes, their lids and brows, a stubble. (The drawn face's `white` and `lips` are not
 * taken.)
 */
export interface Eyes {
  readonly eyes: string
  readonly stubble?: string | undefined
  readonly lids?: string | undefined
  readonly brows?: string | undefined
  /** The mouth's mark; the library's `mouth` when left out. */
  readonly mouth?: string | undefined
}
export type Classic = Top | Trousers | Shoes | Cape | HairGarment | CapGarment | Eyes

/**
 * A garment an extension's wardrobe registers (`registerGarment`): core knows only that it is an object, its first
 * key naming its cloth's swatch. The wardrobe types its own kinds and narrows an item to one where it builds it.
 */
export type CustomGarment = object

/** A garment: its kind's key names its cloth's swatch; the other fields are that kind's options. */
export type Garment = Classic | CustomGarment

const swatch = contentRef('figure-swatch')
const optionalSwatch = swatch.optional()
const flag = z.boolean().optional()
/**
 * The garments' numbers, each bounded (review): a little past what the library, the
 * builders' defaults and the random wardrobe's draws use, so any value in range builds a sound garment. Out of
 * range they break the build (cargos of width 0 run out of memory) or the garment (a skirt above the hip).
 */
const within = (min: number, max: number) => z.number().min(min).max(max)
/** A hanging garment's length: 0 the hip, 0.5 the knee, 1 the ankle (garments/classic.ts hemAt). */
const length = within(0, 1)

const hair: z.ZodType<HairGarment> = z.strictObject({
  hair: swatch,
  style: refOrInline<HairStyle | readonly Lock[]>('figure-hair', {
    object: hairStyleSchema,
    array: z.array(lockSchema).min(1),
  }).optional(),
  tie: optionalSwatch,
})
const cap: z.ZodType<CapGarment> = z.strictObject({
  cap: swatch,
  style: refOrInline<Headwear>('figure-headwear', { object: headwearSchema }),
  mark: optionalSwatch,
})

// Keyed in the order the builder tells garments apart (garments/dress.ts).
const CLASSIC: Readonly<Record<string, z.ZodType<Garment>>> = {
  // garments.ts
  top: z.strictObject({
    top: swatch,
    sleeves: z.enum(['none', 'short', 'long']).optional(),
    cuffs: optionalSwatch,
    collar: optionalSwatch,
  }),
  trousers: z.strictObject({ trousers: swatch }),
  shoes: z.strictObject({ shoes: swatch, sole: optionalSwatch, boots: flag }),
  cape: z.strictObject({ cape: swatch, length: length.optional(), trim: optionalSwatch }),
  hair,
  cap,
  eyes: z.strictObject({
    eyes: swatch,
    stubble: optionalSwatch,
    lids: optionalSwatch,
    brows: optionalSwatch,
    mouth: optionalSwatch,
  }),
}

/**
 * A kind's schema with its default swatches written in where an item names none (garment-defaults.ts, or an
 * extension's own table), as references: the compiler checks them like any other, and reports one the library
 * lacks at the garment. A table with nothing for the kind leaves the schema as it is.
 */
export const withSwatchDefaults = (
  schema: z.ZodType<Garment>,
  defaults: Readonly<Record<string, string | readonly string[]>> | undefined,
): z.ZodType<Garment> => {
  if (defaults === undefined) return schema
  const ref = (id: string): string => swatch.parse(id)
  return schema.transform((garment): Garment => {
    const filled: Record<string, unknown> = { ...garment }
    for (const [field, id] of Object.entries(defaults))
      if (filled[field] === undefined) filled[field] = typeof id === 'string' ? ref(id) : id.map(ref)
    return filled as unknown as Garment
  }) as unknown as z.ZodType<Garment>
}

/** The classic garments' item schemas by name, in the order they are told apart; `classic-kinds.ts` registers them. */
export const CLASSIC_SCHEMAS: Readonly<Record<string, z.ZodType<Garment>>> = Object.fromEntries(
  Object.entries(CLASSIC).map(([key, schema]) => [
    key,
    withSwatchDefaults(schema, GARMENT_DEFAULTS[key as keyof typeof GARMENT_DEFAULTS]),
  ]),
)

/** A garment: parsed by the schema of the first registered kind whose name is one of its keys. */
export const garmentSchema: z.ZodType<Garment> = keyedUnion<Garment>('garment', () =>
  Object.fromEntries(Object.entries(GARMENTS).map(([name, kind]) => [name, kind.schema])),
)
