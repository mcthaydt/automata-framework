// Garments: what an outfit is made of (FigureBuilder src/render/figure/garments.ts `Garment` and
// streetwear.ts's garment shapes at a1f7246). Each garment is an object named by its first key (`coat`,
// `top`, `hoodie`…), whose value is its cloth's swatch. Every swatch field is a library reference, so a
// missing swatch is a compile error at its line (F-e). M3.5b, which builds them (garments/, streetwear/),
// typed each one. Left out: streetwear's `graphics` and the chain's `pendant` (the SNEKPRTY marks and plates
// stay in FigureBuilder), the painter's washes (the skirt's `stain`, the wide-legs' `fade`) and the drawn
// face's colours (the eyes' `white` and `lips`).

import { contentRef } from '@mcthaydt/automata-content'
import { z } from 'zod'
import { type HairStyle, hairStyleSchema } from '../library/hair.schema'
import { type Headwear, headwearSchema, type Lock, lockSchema } from '../library/headwear.schema'
import { keyedUnion } from '../library/keyed-union'
import { refOrInline } from '../library/ref-or-inline'
import { side } from '../library/shapes.schema'

type Opt<T> = T | undefined

// ─── garments.ts ───
/** A shirt or a dress's body: it repaints the torso and as much of the arms as its sleeves cover. */
export interface Top {
  readonly top: string
  readonly sleeves?: Opt<'none' | 'short' | 'long'>
  readonly cuffs?: Opt<string>
  readonly collar?: Opt<string>
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
  readonly sole?: Opt<string>
  readonly boots?: Opt<boolean>
}
/** A skirt hanging from the waist to `length` (0 the hip, 0.5 the knee, 1 the ankle). */
export interface Skirt {
  readonly skirt: string
  readonly length: number
  readonly flare?: Opt<number>
  readonly folds?: Opt<number>
  readonly hem?: Opt<string>
}
export interface Apron {
  readonly apron: string
  readonly shade?: Opt<string>
  readonly length: number
  readonly bib?: Opt<boolean>
  readonly straps?: Opt<'cross' | 'neck'>
  readonly pockets?: Opt<boolean>
  /**
   * The bib's half-width (of the shoulders), how far the skirt wraps round (rad either side of the front).
   */
  readonly bibWidth?: Opt<number>
  readonly wrap?: Opt<number>
  /** A tie knotted at the back. */
  readonly tie?: Opt<boolean>
}
export interface Coat {
  readonly coat: string
  readonly length: number
  readonly buttons?: Opt<string>
  readonly collar?: Opt<string>
}
export interface Belt {
  readonly belt: string
  readonly buckle?: Opt<string>
}
export interface Cape {
  readonly cape: string
  readonly length?: Opt<number>
  readonly trim?: Opt<string>
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
  readonly style?: Opt<string | HairStyle | readonly Lock[]>
  readonly tie?: Opt<string>
}
export interface CapGarment {
  readonly cap: string
  readonly style: string | Headwear
  readonly mark?: Opt<string>
}
/**
 * The face's marks: the eyes, their lids and brows, a stubble. (The drawn face's `white` and `lips` are not
 * taken.)
 */
export interface Eyes {
  readonly eyes: string
  readonly stubble?: Opt<string>
  readonly lids?: Opt<string>
  readonly brows?: Opt<string>
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
  readonly trim?: Opt<string>
  readonly zip?: Opt<string>
  readonly length?: Opt<number>
  readonly baffles?: Opt<number>
}
/**
 * A hoodie: the hood lying on the back, a kangaroo pocket, drawstrings (`aglets` their tips), ribbed cuffs
 * and hem.
 */
export interface Hoodie {
  readonly hoodie: string
  readonly rib?: Opt<string>
  readonly inside?: Opt<string>
  readonly cords?: Opt<string>
  readonly aglets?: Opt<string>
}
/** An oversized tee: `fit` its width over the shoulders (1.16 oversized); `sleeves: false` under a jacket. */
export interface Tee {
  readonly tee: string
  readonly rib?: Opt<string>
  readonly fit?: Opt<number>
  readonly sleeves?: Opt<boolean>
  readonly length?: Opt<number>
}
/**
 * A moto jacket cropped to the waist: `zip` its teeth top to foot, `hardware` the buckle, snaps and small
 * zips.
 */
export interface Jacket {
  readonly jacket: string
  readonly zip?: Opt<readonly string[]>
  readonly hardware?: Opt<string>
}
/**
 * A leather bomber: rib band, collar and cuffs, a centre zip, slash pockets; `tipping` a stripe round the
 * rib.
 */
export interface Bomber {
  readonly bomber: string
  readonly rib?: Opt<string>
  readonly zip?: Opt<readonly string[]>
  readonly hardware?: Opt<string>
  readonly tipping?: Opt<string>
}
/** Wide-leg trousers with a stacked break over the shoe; `stitch` the topstitching. */
export interface WideLegs {
  readonly wideLegs: string
  readonly stitch?: Opt<string>
  readonly hardware?: Opt<string>
}
/**
 * Cargos: wide and straight (`width` of the era's cut), bellows pockets; `cuff` gathers the ankle instead.
 */
export interface Cargos {
  readonly cargos: string
  readonly hardware?: Opt<string>
  readonly width?: Opt<number>
  readonly cuff?: Opt<boolean>
  readonly stitch?: Opt<string>
}
/** Chunky sneakers: a thick two-tone sole, a padded collar, a mudguard; `court` a cupsole's flat sole. */
export interface Sneakers {
  readonly sneakers: string
  readonly mudguard?: Opt<string>
  readonly sole?: Opt<string>
  readonly outsole?: Opt<string>
  readonly laces?: Opt<string>
  readonly court?: Opt<boolean>
  readonly tab?: Opt<string>
}
/** A chain round the neck lying on the outermost top, `drop` (m at 1.62 m) its U's depth on the chest. */
export interface Chain {
  readonly chain: string
  readonly links?: Opt<string>
  readonly drop?: Opt<number>
}
/** Hoops from the lobes, `size` their drop (of the head's height; under 0.12 a stud). */
export interface Hoops {
  readonly hoops: string
  readonly size?: Opt<number>
}
/** Wraparound shades; `up` pushed back onto the head. */
export interface Shades {
  readonly shades: string
  readonly frame?: Opt<string>
  readonly up?: Opt<boolean>
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
const n = z.number()
const flag = z.boolean().optional()

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
    length: n,
    flare: n.optional(),
    folds: n.optional(),
    hem: optionalSwatch,
  }),
  apron: z.strictObject({
    apron: swatch,
    shade: optionalSwatch,
    length: n,
    bib: flag,
    straps: z.enum(['cross', 'neck']).optional(),
    pockets: flag,
    bibWidth: n.optional(),
    wrap: n.optional(),
    tie: flag,
  }),
  coat: z.strictObject({ coat: swatch, length: n, buttons: optionalSwatch, collar: optionalSwatch }),
  belt: z.strictObject({ belt: swatch, buckle: optionalSwatch }),
  cape: z.strictObject({ cape: swatch, length: n.optional(), trim: optionalSwatch }),
  gloves: z.strictObject({ gloves: swatch }),
  hair,
  cap,
  eyes: z.strictObject({
    eyes: swatch,
    stubble: optionalSwatch,
    lids: optionalSwatch,
    brows: optionalSwatch,
  }),
  mark: z.strictObject({ mark: z.enum(['watch', 'badge']), colour: swatch, side }),
  // streetwear.ts
  puffer: z.strictObject({
    puffer: swatch,
    trim: optionalSwatch,
    zip: optionalSwatch,
    length: n.optional(),
    baffles: n.optional(),
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
    fit: n.optional(),
    sleeves: flag,
    length: n.optional(),
  }),
  jacket: z.strictObject({ jacket: swatch, zip: z.array(swatch).optional(), hardware: optionalSwatch }),
  bomber: z.strictObject({
    bomber: swatch,
    rib: optionalSwatch,
    zip: z.array(swatch).optional(),
    hardware: optionalSwatch,
    tipping: optionalSwatch,
  }),
  wideLegs: z.strictObject({ wideLegs: swatch, stitch: optionalSwatch, hardware: optionalSwatch }),
  cargos: z.strictObject({
    cargos: swatch,
    hardware: optionalSwatch,
    width: n.optional(),
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
  chain: z.strictObject({ chain: swatch, links: optionalSwatch, drop: n.optional() }),
  hoops: z.strictObject({ hoops: swatch, size: n.optional() }),
  shades: z.strictObject({ shades: swatch, frame: optionalSwatch, up: flag }),
}

export const garmentSchema: z.ZodType<Garment> = keyedUnion<Garment>('garment', GARMENTS)
