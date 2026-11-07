// A swatch: a step of one of DUEL's 32 ramps (`{ ramp = "skin", step = 5 }`) and the few material fields a lit
// mesh needs (materials name palette colours, by ramp and step,
// the way FigureBuilder's swatches name theirs). FigureBuilder's painter fields stay in FigureBuilder. `kind` and `role` are what a wardrobe's garments match swatches by (the garment registry's `Kind`, `Role`).

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
}

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
})

/** The palette index a swatch's ramp and step name (DUEL's order: ramp * 8 + step). */
export const swatchColour = (swatch: Pick<Swatch, 'ramp' | 'step'>): number =>
  duelIndex(swatch.ramp, swatch.step)
