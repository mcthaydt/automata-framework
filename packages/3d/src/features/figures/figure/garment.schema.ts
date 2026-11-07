// Garments: what an outfit is made of (FigureBuilder src/render/figure/garments.ts `Garment` and
// streetwear.ts's garment shapes at a1f7246). Each garment is an object named by its first key (`coat`,
// `top`, `hoodie`…), whose value is its cloth's swatch. Every swatch field is a library reference, so a
// missing swatch is a compile error at its line (F-e). M3.5b, which builds them (garments/, streetwear/),
// typed each one. Left out: streetwear's `graphics` and the chain's `pendant` (the SNEKPRTY marks and plates
// stay in FigureBuilder), the painter's washes (the skirt's `stain`, the wide-legs' `fade`) and the drawn
// face's colours (the eyes' `white` and `lips`).

import { contentRef } from '@automata/content/schema'
import { z } from 'zod'
import { type HairStyle, hairStyleSchema } from '../content/hair.schema.ts'
import { type Headwear, headwearSchema, type Lock, lockSchema } from '../content/headwear.schema.ts'
import { keyedUnion } from '../content/keyed-union.ts'
import { refOrInline } from '../content/ref-or-inline.ts'
import { side } from '../content/shapes.schema.ts'
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

// ─── streetwear.ts ───
/**
 * A cropped puffer: quilted baffles, a high collar, full sleeves; `length` 0 ends it at the waist, 1 at the
 * hip.
 */
export interface Puffer {
  readonly puffer: string
  readonly trim?: string | undefined
  readonly zip?: string | undefined
  /** The zip's pull at the chin. */
  readonly pull?: string | undefined
  readonly length?: number | undefined
  readonly baffles?: number | undefined
}
/**
 * A hoodie: the hood lying on the back, a kangaroo pocket, drawstrings (`aglets` their tips), ribbed cuffs
 * and hem.
 */
export interface Hoodie {
  readonly hoodie: string
  readonly rib?: string | undefined
  readonly inside?: string | undefined
  readonly cords?: string | undefined
  readonly aglets?: string | undefined
}
/** An oversized tee: `fit` its width over the shoulders (1.16 oversized); `sleeves: false` under a jacket. */
export interface Tee {
  readonly tee: string
  readonly rib?: string | undefined
  readonly fit?: number | undefined
  readonly sleeves?: boolean | undefined
  readonly length?: number | undefined
}
/**
 * A moto jacket cropped to the waist: `zip` its teeth top to foot, `hardware` the buckle, snaps and small
 * zips.
 */
export interface Jacket {
  readonly jacket: string
  readonly zip?: readonly string[] | undefined
  readonly hardware?: string | undefined
}
/**
 * A leather bomber: rib band, collar and cuffs, a centre zip, slash pockets; `tipping` a stripe round the
 * rib.
 */
export interface Bomber {
  readonly bomber: string
  readonly rib?: string | undefined
  readonly zip?: readonly string[] | undefined
  readonly hardware?: string | undefined
  readonly tipping?: string | undefined
}
/** Wide-leg trousers with a stacked break over the shoe; `stitch` the topstitching. */
export interface WideLegs {
  readonly wideLegs: string
  readonly stitch?: string | undefined
  readonly hardware?: string | undefined
}
/**
 * Cargos: wide and straight (`width` of the era's cut), bellows pockets; `cuff` gathers the ankle instead.
 */
export interface Cargos {
  readonly cargos: string
  readonly hardware?: string | undefined
  readonly width?: number | undefined
  readonly cuff?: boolean | undefined
  readonly stitch?: string | undefined
}
/** Chunky sneakers: a thick two-tone sole, a padded collar, a mudguard; `court` a cupsole's flat sole. */
export interface Sneakers {
  readonly sneakers: string
  readonly mudguard?: string | undefined
  readonly sole?: string | undefined
  readonly outsole?: string | undefined
  readonly laces?: string | undefined
  readonly court?: boolean | undefined
  readonly tab?: string | undefined
}
/** A chain round the neck lying on the outermost top, `drop` (m at 1.62 m) its U's depth on the chest. */
export interface Chain {
  readonly chain: string
  readonly links?: string | undefined
  readonly drop?: number | undefined
}
/** Hoops from the lobes, `size` their drop (of the head's height; under 0.12 a stud). */
export interface Hoops {
  readonly hoops: string
  readonly size?: number | undefined
}
/** Wraparound shades; `up` pushed back onto the head. */
export interface Shades {
  readonly shades: string
  readonly frame?: string | undefined
  readonly up?: boolean | undefined
}
export type Streetwear =
  | Puffer
  | Hoodie
  | Tee
  | Jacket
  | Bomber
  | WideLegs
  | Cargos
  | Sneakers
  | Chain
  | Hoops
  | Shades

/** A garment: its kind's key names its cloth's swatch; the other fields are that kind's options. */
export type Garment = Classic | Streetwear

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
/** A zip's teeth, top to foot: at least one swatch. */
const zip = z.array(swatch).min(1).optional()

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
const GARMENTS: Readonly<Record<string, z.ZodType<Garment>>> = {
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
  // streetwear.ts
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

/**
 * Each garment with its default swatches written in where its file names none (garment-defaults.ts), as
 * references: the compiler checks them like any other, and reports one the library lacks at the garment.
 */
const withDefaults = (key: string, schema: z.ZodType<Garment>): z.ZodType<Garment> => {
  const defaults: Readonly<Record<string, string | readonly string[]>> | undefined =
    GARMENT_DEFAULTS[key as keyof typeof GARMENT_DEFAULTS]
  if (defaults === undefined) return schema
  const ref = (id: string): string => swatch.parse(id)
  return schema.transform((garment): Garment => {
    const filled: Record<string, unknown> = { ...garment }
    for (const [field, id] of Object.entries(defaults))
      if (filled[field] === undefined) filled[field] = typeof id === 'string' ? ref(id) : id.map(ref)
    return filled as unknown as Garment
  }) as unknown as z.ZodType<Garment>
}

export const garmentSchema: z.ZodType<Garment> = keyedUnion<Garment>(
  'garment',
  Object.fromEntries(Object.entries(GARMENTS).map(([key, schema]) => [key, withDefaults(key, schema)])),
)
