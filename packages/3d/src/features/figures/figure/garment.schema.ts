// Garments: what an outfit is made of (FigureBuilder src/render/figure/garments.ts `Garment` at a1f7246). Each
// garment is an object named by its first key (`coat`, `top`, `cape`…), whose value is its cloth's swatch.
// Every swatch field is a library reference, so a missing swatch is a compile error at its line (F-e). The 15
// classic garments are typed here; an extension's wardrobe types and registers its own (`registerGarment`).
// Left out: the painter's washes (the skirt's `stain`) and the drawn face's colours (the eyes' `white` and `lips`).

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
export interface Waistcoat {
  readonly waistcoat: string
}
export interface Trousers {
  readonly trousers: string
}
/** Stockings: the legs repainted from the thigh down. */
export interface LegWear {
  readonly legs: string
}
export interface Shoes {
  readonly shoes: string
  readonly sole?: string | undefined
  readonly boots?: boolean | undefined
}
/** A skirt hanging from the waist to `length` (0 the hip, 0.5 the knee, 1 the ankle). */
export interface Skirt {
  readonly skirt: string
  readonly length: number
  readonly flare?: number | undefined
  readonly folds?: number | undefined
  readonly hem?: string | undefined
}
export interface Apron {
  readonly apron: string
  readonly shade?: string | undefined
  readonly length: number
  readonly bib?: boolean | undefined
  readonly straps?: 'cross' | 'neck' | undefined
  readonly pockets?: boolean | undefined
  /**
   * The bib's half-width (of the shoulders), how far the skirt wraps round (rad either side of the front).
   */
  readonly bibWidth?: number | undefined
  readonly wrap?: number | undefined
  /** A tie knotted at the back. */
  readonly tie?: boolean | undefined
}
export interface Coat {
  readonly coat: string
  readonly length: number
  readonly buttons?: string | undefined
  readonly collar?: string | undefined
}
export interface Belt {
  readonly belt: string
  readonly buckle?: string | undefined
}
export interface Cape {
  readonly cape: string
  readonly length?: number | undefined
  readonly trim?: string | undefined
}
export interface Gloves {
  readonly gloves: string
}
/**
 * Hair in a swatch's colour: a style from the hair library (or written inline: a style, or its locks), or,
 * with no style, the figure's own `hairPieces` (M3.5b decision 6). `tie` the band a pony or a bun is tied
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
/** A watch or a badge on the chest, on one side. */
export interface Mark {
  readonly mark: 'watch' | 'badge'
  readonly colour: string
  readonly side: 'L' | 'R'
}
export type Classic =
  | Top
  | Waistcoat
  | Trousers
  | LegWear
  | Shoes
  | Skirt
  | Apron
  | Coat
  | Belt
  | Cape
  | Gloves
  | HairGarment
  | CapGarment
  | Eyes
  | Mark

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
 * The garments' numbers, each bounded (M3.5b review): a little past what FigureBuilder's library, its
 * builders' defaults and its random wardrobe's draws use, so any value in range builds a sound garment. Out of
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

// Keyed in the order the builder tells garments apart (garments/dress.ts): a cap's `mark` is the cap's.
const CLASSIC: Readonly<Record<string, z.ZodType<Garment>>> = {
  // garments.ts
  top: z.strictObject({
    top: swatch,
    sleeves: z.enum(['none', 'short', 'long']).optional(),
    cuffs: optionalSwatch,
    collar: optionalSwatch,
  }),
  waistcoat: z.strictObject({ waistcoat: swatch }),
  trousers: z.strictObject({ trousers: swatch }),
  legs: z.strictObject({ legs: swatch }),
  shoes: z.strictObject({ shoes: swatch, sole: optionalSwatch, boots: flag }),
  skirt: z.strictObject({
    skirt: swatch,
    length,
    flare: within(0, 2).optional(),
    folds: within(0, 0.3).optional(),
    hem: optionalSwatch,
  }),
  apron: z.strictObject({
    apron: swatch,
    shade: optionalSwatch,
    length,
    bib: flag,
    straps: z.enum(['cross', 'neck']).optional(),
    pockets: flag,
    // Of the shoulders' half-width; rad either side of the front.
    bibWidth: within(0.1, 1.2).optional(),
    wrap: within(0.2, Math.PI).optional(),
    tie: flag,
  }),
  coat: z.strictObject({ coat: swatch, length, buttons: optionalSwatch, collar: optionalSwatch }),
  belt: z.strictObject({ belt: swatch, buckle: optionalSwatch }),
  cape: z.strictObject({ cape: swatch, length: length.optional(), trim: optionalSwatch }),
  gloves: z.strictObject({ gloves: swatch }),
  hair,
  cap,
  eyes: z.strictObject({
    eyes: swatch,
    stubble: optionalSwatch,
    lids: optionalSwatch,
    brows: optionalSwatch,
    mouth: optionalSwatch,
  }),
  mark: z.strictObject({ mark: z.enum(['watch', 'badge']), colour: swatch, side }),
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
