// A swatch: a colour of the game's palette and the few material fields a lit mesh needs (M3 spec §4.4.1,
// amended 2026-10-30: materials name palette colours). FigureBuilder's swatches (src/render/figure/parts.ts
// `Material`, library/swatches.json at a1f7246) are DUEL ramp rows with painter fields; those stay in
// FigureBuilder. `kind` and `role` are what streetwear matches swatches by (streetwear.ts `Kind`, `Role`).

import { z } from 'zod'
import { about } from './shapes.schema'

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
  /** A 0-based index into the game's palette content (Endesga 64 by default). */
  readonly colour: number
  /** 0–1: how glossy the surface is (hair, shoes, buckles). */
  readonly gloss?: number | undefined
  /** Unlit: eyes, marks and soles that keep their colour in any light. */
  readonly flat?: boolean | undefined
  readonly kind?: (typeof SWATCH_KINDS)[number] | undefined
  readonly role?: (typeof SWATCH_ROLES)[number] | undefined
}

export const swatchSchema: z.ZodType<Swatch> = z.strictObject({
  about,
  // A palette has at most 256 colours (content's palette schema); the game's own palette is checked by
  // swatchColourProblems, because a schema sees one file, not the palette.
  colour: z.number().int().min(0).max(255),
  gloss: z.number().min(0).max(1).optional(),
  flat: z.boolean().optional(),
  kind: z.enum(SWATCH_KINDS).optional(),
  role: z.enum(SWATCH_ROLES).optional(),
})
