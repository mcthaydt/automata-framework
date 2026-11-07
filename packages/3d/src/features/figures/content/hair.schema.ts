// Hair styles: a list of registered pieces, or a list of locks (FigureBuilder src/render/figure/hair.ts `HairStyle`,
// `Piece` and `Rope`; library/hair.json at a1f7246). Positions are in head units round the skull, so a style fits any
// head. Core knows the locks and the rope (the one mesh every piece is swept from); the pieces themselves (a scalp,
// rows, a tail, a fall, a bun, a sweep, a block, edges) are @automata/character-kit's, which registers each kind
// with its own schema. A tone is one of the hair's own tones or a swatch id, checked like every library reference.

import { contentRef } from '@automata/content/schema'
import { z } from 'zod'
import { finishNames } from '../registry/hair-finish-registry.ts'
import { registeredHairPieces } from '../registry/hair-piece-registry.ts'
import { type Lock, lockSchema } from './headwear.schema.ts'
import { keyedUnion } from './keyed-union.ts'
import { about, type Vec2, vec2 } from './shapes.schema.ts'

/** The hair's own tones (hair.ts `Tone`); anything else is a swatch id. */
export const HAIR_TONES = ['hair', 'lit', 'crest', 'fade1', 'fade2', 'scalp', 'parting', 'fade'] as const

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
/** One entry of a style's `pieces`: an object whose one key names a registered piece kind and whose value is that piece's data. */
export type Piece = Readonly<Record<string, unknown>>
export interface HairStyle {
  readonly about?: string | undefined
  readonly finish?: string | undefined
  readonly pieces?: readonly Piece[] | undefined
  readonly locks?: readonly Lock[] | undefined
}

const n = z.number()
/** A hair tone: one of the hair's own, or a swatch id. */
export const toneSchema: z.ZodType<string> = z.union([z.enum(HAIR_TONES), contentRef('figure-swatch')])
/** A pony or bun's tie: `true` the wearer's own, or a swatch id. */
export const tieSchema: z.ZodType<boolean | string> = z.union([z.boolean(), contentRef('figure-swatch')])

export const ropeSchema: z.ZodType<Rope> = z.strictObject({
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

/** The pieces an extension registered (read at each parse: a kind can arrive after this module loads). A piece's data
 * is checked by its own schema alone. */
const piece: z.ZodType<Piece> = keyedUnion<Piece>('hair piece', () =>
  Object.fromEntries(
    registeredHairPieces().map(([kind, p]) => [
      kind,
      z.strictObject({ [kind]: p.schema ?? z.unknown() }) as unknown as z.ZodType<Piece>,
    ]),
  ),
)

/** A finish is a base one or one an extension registered (read at each parse). */
const finish = z.string().refine((name) => finishNames().includes(name), {
  error: (issue) => `a finish is one of: ${finishNames().join(', ')} (not "${String(issue.input)}")`,
})

/** A hair style's body: its pieces or its locks (shared by the library kind and a figure's inline style). */
export const hairStyleSchema: z.ZodType<HairStyle> = z
  .strictObject({
    about,
    finish: finish.optional(),
    pieces: z.array(piece).min(1).optional(),
    locks: z.array(lockSchema).min(1).optional(),
  })
  .refine((style) => style.pieces !== undefined || style.locks !== undefined, {
    message: 'a hair style needs pieces or locks',
  })
