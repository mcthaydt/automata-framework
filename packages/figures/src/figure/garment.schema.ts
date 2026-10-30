// Garments: what an outfit is made of (FigureBuilder src/render/figure/garments.ts `Garment` and
// streetwear.ts's garment shapes at a1f7246). Each garment is an object named by its first key (`coat`,
// `top`, `hoodie`…), whose value is its cloth's swatch. Every swatch field is a library reference, so a missing
// swatch is a compile error at its line (F-e). M3.5b builds them and may tighten the number ranges.
// Left out: streetwear's `graphics` and the chain's `pendant` (the SNEKPRTY marks and plates stay in
// FigureBuilder), and the skirt's `stain` (a painter wash).

import { contentRef } from '@mcthaydt/automata-content'
import { z } from 'zod'
import { type HairStyle, hairStyleSchema } from '../library/hair.schema'
import { type Headwear, headwearSchema, type Lock, lockSchema } from '../library/headwear.schema'
import { keyedUnion } from '../library/keyed-union'
import { refOrInline } from '../library/ref-or-inline'
import { side } from '../library/shapes.schema'

/** A garment: its kind's key names its cloth's swatch; the other fields are that kind's options. */
export type Garment = Readonly<Record<string, unknown>>

const swatch = contentRef('figure-swatch')
const optionalSwatch = swatch.optional()
const n = z.number()
const flag = z.boolean().optional()

/** `{ hair = "<swatch>", style = "<hair id>" }`, or a style written inline (locks, or a style's pieces). */
const hair = z.strictObject({
  hair: swatch,
  style: refOrInline<HairStyle | readonly Lock[]>('figure-hair', {
    object: hairStyleSchema,
    array: z.array(lockSchema).min(1),
  }),
  tie: optionalSwatch,
})
/** `{ cap = "<swatch>", style = "<headwear id>" }`, or headwear written inline. */
const cap = z.strictObject({
  cap: swatch,
  style: refOrInline<Headwear>('figure-headwear', { object: headwearSchema }),
  mark: optionalSwatch,
})

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
    white: optionalSwatch,
    lips: optionalSwatch,
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
  wideLegs: z.strictObject({
    wideLegs: swatch,
    fade: optionalSwatch,
    stitch: optionalSwatch,
    hardware: optionalSwatch,
  }),
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
