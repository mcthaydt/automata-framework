// A swatch: a step of one of DUEL's 32 ramps (`{ ramp = "skin", step = 5 }`), the painter's optional fields for a
// material that wants more than that step (a hand-picked ramp, its own key-light thresholds, strands, a stain, a
// holo sheen, a fabric), and the `gloss` and `flat` the sprite light reads. A swatch with none of the painter's
// fields paints from its DUEL row alone, so a game's existing files keep parsing. `kind` and `role` are what a
// wardrobe's garments match swatches by (the garment registry's `Kind`, `Role`).

import { DUEL_RAMP_NAMES, type DuelRampName, duelIndex } from '@automata/content/palette'
import { z } from 'zod'
import { about } from './shapes.schema.ts'

export const SWATCH_KINDS = [
  'cloth',
  'knit',
  'denim',
  'leather',
  'twill',
  'rubber',
  'metal',
  'lens',
  'thread',
] as const
export const SWATCH_ROLES = ['main', 'rib', 'inside', 'trim', 'stitch', 'sole', 'hardware', 'lens'] as const

/** A painter's ramp: light, mid, shadow, deep, as `#rrggbb`. */
export type PaintRamp = readonly [string, string, string, string]

export interface Swatch {
  readonly about?: string | undefined
  /** One of DUEL's 32 ramps, by name. */
  readonly ramp: DuelRampName
  /** 0 (darkest) to 7 (lightest) along the ramp. */
  readonly step: number
  /** 0–1: how glossy the surface is (hair, shoes, buckles). */
  readonly gloss?: number | undefined
  /** Unlit: eyes, marks and soles that keep their colour in any light. */
  readonly flat?: boolean | undefined
  readonly kind?: (typeof SWATCH_KINDS)[number] | undefined
  readonly role?: (typeof SWATCH_ROLES)[number] | undefined
  /** Steps the painter lifts the lit tone, where its own ramp is too dark for the form light. */
  readonly lift?: number | undefined
  /** A hand-picked ramp, light to deep, in place of four steps of the DUEL row. */
  readonly paint?: PaintRamp | undefined
  /** Its own key-light thresholds, where the style's do not suit it (skin sits mostly on its light tone). */
  readonly tones?: readonly [number, number, number] | undefined
  /** Grain drawn as strands along the part (hair). */
  readonly strands?: boolean | undefined
  /** Glossy hair: the painter lays its sheen band round the crown. */
  readonly sheen?: boolean | undefined
  /** Fine vertical folds: how far the strand noise moves cloth along its ramp. */
  readonly streaks?: number | undefined
  /** A blend of two ramps in place of `paint`: `at` of the way from each tone of `from` to `to`. */
  readonly mix?: { readonly from: PaintRamp; readonly to: PaintRamp; readonly at: number } | undefined
  /** A stain from `hem` up to `below` (metres, in the surface's rest space) in this ramp. */
  readonly stain?: { readonly paint: PaintRamp; readonly hem: number; readonly below: number } | undefined
  /** Iridescent, or `'mirror'` for a mirrored lens. */
  readonly holo?: boolean | 'mirror' | undefined
  /** A tinted lens: the eyes under it show through, faintly. */
  readonly see?: boolean | undefined
  /** A registered fabric, laid on the cloth as tone offsets within this material's own ramp. */
  readonly fabric?: string | undefined
}

const hex = z.string().regex(/^#[0-9a-f]{6}$/i, 'a colour is #rrggbb')
const paintRamp: z.ZodType<PaintRamp> = z.tuple([hex, hex, hex, hex])

export const swatchSchema: z.ZodType<Swatch> = z.strictObject({
  about,
  ramp: z.enum(DUEL_RAMP_NAMES),
  // The same check and words as `duelIndex`, so a step is refused the same way wherever it is read. A game's own
  // palette is checked by swatchColourProblems, because a schema sees one file, not the palette.
  step: z.number().refine((n) => Number.isInteger(n) && n >= 0 && n <= 7, 'step is 0 to 7'),
  gloss: z.number().min(0).max(1).optional(),
  flat: z.boolean().optional(),
  kind: z.enum(SWATCH_KINDS).optional(),
  role: z.enum(SWATCH_ROLES).optional(),
  lift: z.number().optional(),
  paint: paintRamp.optional(),
  tones: z.tuple([z.number(), z.number(), z.number()]).optional(),
  strands: z.boolean().optional(),
  sheen: z.boolean().optional(),
  streaks: z.number().min(0).optional(),
  mix: z.strictObject({ from: paintRamp, to: paintRamp, at: z.number().min(0).max(1) }).optional(),
  stain: z.strictObject({ paint: paintRamp, hem: z.number(), below: z.number() }).optional(),
  holo: z.union([z.boolean(), z.literal('mirror')]).optional(),
  see: z.boolean().optional(),
  fabric: z.string().min(1).optional(),
})

/** The palette index a swatch's ramp and step name (DUEL's order: ramp * 8 + step). */
export const swatchColour = (swatch: Pick<Swatch, 'ramp' | 'step'>): number =>
  duelIndex(swatch.ramp, swatch.step)
