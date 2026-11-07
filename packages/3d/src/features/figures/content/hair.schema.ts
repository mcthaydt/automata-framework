// Hair styles: the generators' pieces, or the older lists of locks (FigureBuilder src/render/figure/hair.ts
// `HairStyle`, `Piece`, `Rope` and the piece shapes; library/hair.json at a1f7246). Positions are in head units
// round the skull, so a style fits any head. The generators that build them are M3.5b's; these are the content
// shapes. A tone is one of the hair's own tones or a swatch id, checked like every library reference.

import { contentRef } from '@automata/content/schema'
import { z } from 'zod'
import { type Lock, lockSchema } from './headwear.schema.ts'
import { keyedUnion } from './keyed-union.ts'
import { about, type Line, line, type Vec2, type Vec3, vec2, vec3 } from './shapes.schema.ts'

/** The hair's own tones (hair.ts `Tone`); anything else is a swatch id. */
export const HAIR_TONES = ['hair', 'lit', 'crest', 'fade1', 'fade2', 'scalp', 'parting', 'fade'] as const
export const HAIR_FINISHES = ['coil', 'braid', 'loc', 'sleek', 'straight'] as const
type Tone = string
/** A pony or bun's tie: `true` the wearer's own, or a swatch id. */
type Tie = boolean | string

/** A rope's make: radius (of the skull's half-width), flatness, squareness, beads, ridges, streaks and ends. */
export interface Rope {
  readonly r: number
  readonly flat?: number | undefined
  readonly e?: number | undefined
  readonly beads?: number | undefined
  readonly pitch?: number | undefined
  readonly depth?: number | undefined
  readonly twist?: number | undefined
  readonly ridges?: Vec2 | undefined
  readonly plait?: number | false | undefined
  readonly phase?: number | undefined
  readonly slant?: number | undefined
  readonly streaks?: readonly number[] | undefined
  readonly tip?: 'point' | 'round' | 'blunt' | undefined
  readonly root?: number | undefined
  readonly taper?: number | undefined
  readonly seg?: number | undefined
}
export interface Scalp {
  readonly from: Line
  readonly to?: Line | undefined
  readonly lift: number
  readonly crown?: number | undefined
  readonly edge?: number | undefined
  readonly ridges?: Vec2 | undefined
  readonly comb?: Vec3 | 'back' | undefined
  readonly tone?: Tone | undefined
  readonly cut?: { readonly at: number; readonly width: number; readonly height: number } | undefined
  readonly sheen?:
    | {
        readonly count: number
        readonly from: number
        readonly to: number
        readonly width?: number | undefined
        readonly ragged?: number | undefined
        readonly at?: number | undefined
      }
    | undefined
  readonly grade?: readonly (readonly [number, Tone])[] | undefined
  readonly span?: number | undefined
}
export interface Rows {
  readonly count: number
  readonly at?: number | undefined
  readonly span: number
  readonly from: Line
  readonly to: Vec3 | 'nape'
  readonly nape?: Line | undefined
  readonly lift: number
  readonly rope: Rope
  readonly apart?: boolean | undefined
  readonly matte?: boolean | undefined
  readonly tone?: Tone | undefined
}
export interface Tail {
  readonly at: Vec3
  readonly count: number
  readonly rope: Rope
  readonly rise: number
  readonly length: number
  readonly spread: Vec2
  readonly tie?: Tie | undefined
  readonly cuffs?: string | undefined
  readonly swing?: number | undefined
  readonly matte?: boolean | undefined
  readonly off?: number | undefined
}
export interface Fall {
  readonly at: readonly (readonly number[])[]
  readonly lift: number
  readonly plumb: number
  readonly out?: number | undefined
  readonly flick?: number | undefined
  readonly rope: Rope
  readonly apart?: boolean | undefined
  readonly tone?: Tone | undefined
  readonly seam?: number | undefined
  readonly matte?: boolean | undefined
  readonly bare?: boolean | undefined
  readonly capped?: boolean | undefined
}
export interface Bun {
  readonly at: Vec3
  readonly r: number
  readonly turns: number
  readonly rope: Rope
  readonly tie?: Tie | undefined
}
export interface Sweep {
  readonly path: readonly Vec3[]
  readonly rope: Rope
  readonly tone?: Tone | undefined
  readonly out?: 'up' | 'skull' | 'front' | Vec3 | undefined
  readonly apart?: boolean | undefined
}
export interface Block {
  readonly from: number
  readonly to: number
  readonly flare?: number | undefined
  readonly lift?: number | undefined
  readonly round?: number | undefined
  readonly coil?: number | undefined
  readonly tone?: Tone | undefined
  readonly top?: Tone | undefined
}
export interface Edges {
  readonly line: Line
  readonly at: readonly (readonly [number, number, number, number])[]
  readonly tone?: Tone | undefined
}
export type Piece =
  | { readonly scalp: Scalp }
  | { readonly rows: Rows }
  | { readonly tail: Tail }
  | { readonly fall: Fall }
  | { readonly bun: Bun }
  | { readonly sweep: Sweep }
  | { readonly block: Block }
  | { readonly edges: Edges }
export interface HairStyle {
  readonly about?: string | undefined
  readonly finish?: (typeof HAIR_FINISHES)[number] | undefined
  readonly pieces?: readonly Piece[] | undefined
  readonly locks?: readonly Lock[] | undefined
}

const n = z.number()
const tone = z.union([z.enum(HAIR_TONES), contentRef('figure-swatch')])
const tie = z.union([z.boolean(), contentRef('figure-swatch')])

const rope: z.ZodType<Rope> = z.strictObject({
  r: z.number().positive(),
  flat: n.optional(),
  e: n.optional(),
  beads: z.number().int().min(0).optional(),
  pitch: n.optional(),
  depth: n.optional(),
  twist: n.optional(),
  ridges: vec2.optional(),
  plait: z.union([n, z.literal(false)]).optional(),
  phase: n.optional(),
  slant: n.optional(),
  streaks: z.array(n).min(3).max(4).optional(),
  tip: z.enum(['point', 'round', 'blunt']).optional(),
  root: n.optional(),
  taper: n.optional(),
  seg: z.number().int().positive().optional(),
})

const scalp: z.ZodType<Scalp> = z.strictObject({
  from: line,
  to: line.optional(),
  lift: n,
  crown: n.optional(),
  edge: n.optional(),
  ridges: vec2.optional(),
  comb: z.union([vec3, z.literal('back')]).optional(),
  tone: tone.optional(),
  cut: z.strictObject({ at: n, width: n, height: n }).optional(),
  sheen: z
    .strictObject({
      count: z.number().int().positive(),
      from: n,
      to: n,
      width: n.optional(),
      ragged: n.optional(),
      at: n.optional(),
    })
    .optional(),
  grade: z.array(z.tuple([n, tone])).optional(),
  span: n.optional(),
})

const rows: z.ZodType<Rows> = z.strictObject({
  count: z.number().int().positive(),
  at: n.optional(),
  span: n,
  from: line,
  to: z.union([vec3, z.literal('nape')]),
  nape: line.optional(),
  lift: n,
  rope,
  apart: z.boolean().optional(),
  matte: z.boolean().optional(),
  tone: tone.optional(),
})

const tail: z.ZodType<Tail> = z.strictObject({
  at: vec3,
  count: z.number().int().positive(),
  rope,
  rise: n,
  length: n,
  spread: vec2,
  tie: tie.optional(),
  cuffs: contentRef('figure-swatch').optional(),
  swing: n.optional(),
  matte: z.boolean().optional(),
  off: n.optional(),
})

const fall: z.ZodType<Fall> = z.strictObject({
  // [angle, root height, tip height, own lift?, tip angle?]
  at: z.array(z.array(n).min(3).max(5)).min(1),
  lift: n,
  plumb: n,
  out: n.optional(),
  flick: n.optional(),
  rope,
  apart: z.boolean().optional(),
  tone: tone.optional(),
  seam: n.optional(),
  matte: z.boolean().optional(),
  bare: z.boolean().optional(),
  capped: z.boolean().optional(),
})

const bun: z.ZodType<Bun> = z.strictObject({ at: vec3, r: n, turns: n, rope, tie: tie.optional() })

const sweep: z.ZodType<Sweep> = z.strictObject({
  path: z.array(vec3).min(2),
  rope,
  tone: tone.optional(),
  out: z.union([z.enum(['up', 'skull', 'front']), vec3]).optional(),
  apart: z.boolean().optional(),
})

const block: z.ZodType<Block> = z.strictObject({
  from: n,
  to: n,
  flare: n.optional(),
  lift: n.optional(),
  round: n.optional(),
  coil: n.optional(),
  tone: tone.optional(),
  top: tone.optional(),
})

const edges: z.ZodType<Edges> = z.strictObject({
  line,
  at: z.array(z.tuple([n, n, n, n])).min(1),
  tone: tone.optional(),
})

const piece: z.ZodType<Piece> = keyedUnion<Piece>('hair piece', {
  scalp: z.strictObject({ scalp }),
  rows: z.strictObject({ rows }),
  tail: z.strictObject({ tail }),
  fall: z.strictObject({ fall }),
  bun: z.strictObject({ bun }),
  sweep: z.strictObject({ sweep }),
  block: z.strictObject({ block }),
  edges: z.strictObject({ edges }),
})

/** A hair style's body: its pieces or its locks (shared by the library kind and a figure's inline style). */
export const hairStyleSchema: z.ZodType<HairStyle> = z
  .strictObject({
    about,
    finish: z.enum(HAIR_FINISHES).optional(),
    pieces: z.array(piece).min(1).optional(),
    locks: z.array(lockSchema).min(1).optional(),
  })
  .refine((style) => style.pieces !== undefined || style.locks !== undefined, {
    message: 'a hair style needs pieces or locks',
  })
