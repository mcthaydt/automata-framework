// A world swatch (the `world-swatch` content kind): what a wall, a floor or a prop is painted with, a step of one of
// DUEL's 32 ramps (`{ ramp = "wood", step = 3 }`) and the few fields the builder and the view read. The photo a
// texture is made from (`texture.photo`) and the painter's own knobs stay data for the photo pipeline; a swatch with
// none draws as its flat palette colour.
//
// Ported from EnvironmentBuilder (mcthaydt/EnvironmentBuilder) src/features/world/library/swatches.json at 6d82a52:
// its `ramp` (a number) is a ramp's name and its `base` is `step`, the way a figure's swatch names its colour.
import { DUEL_RAMP_NAMES, DUEL_RAMPS, type DuelRampName } from '@automata/content/palette'
import { z } from 'zod'

export interface WorldSwatch {
  readonly about?: string | undefined
  /** One of DUEL's 32 ramps, by name. */
  readonly ramp: DuelRampName
  /** 0 (darkest) to 7 (lightest) along the ramp. */
  readonly step: number
  /** Glows: a lamp shade, a window at night, a neon tube. */
  readonly emit?: boolean | undefined
  /** Unlit: keeps its colour in any light. */
  readonly flat?: boolean | undefined
  /** Casts no shadow. */
  readonly noCast?: boolean | undefined
  readonly gloss?: number | undefined
  /** The photo it is cut from, and how the photo pipeline treats it. */
  readonly texture?: Readonly<Record<string, unknown>> | undefined
  /** A graphic design laid over it (stripes, a checker, glass), not a material. */
  readonly pattern?: Readonly<Record<string, unknown>> | undefined
  /** The swatch a stain or grime on it is drawn in. */
  readonly accent?: string | undefined
}

export const worldSwatchSchema: z.ZodType<WorldSwatch> = z.looseObject({
  about: z.string().optional(),
  ramp: z.enum(DUEL_RAMP_NAMES),
  step: z.number().refine((n) => Number.isInteger(n) && n >= 0 && n <= 7, 'step is 0 to 7'),
  emit: z.boolean().optional(),
  flat: z.boolean().optional(),
  noCast: z.boolean().optional(),
  gloss: z.number().min(0).max(1).optional(),
  texture: z.record(z.string(), z.unknown()).optional(),
  pattern: z.record(z.string(), z.unknown()).optional(),
  accent: z.string().optional(),
})

/** A swatch's colour as `0xRRGGBB`, from DUEL. */
export function swatchRgb(swatch: Pick<WorldSwatch, 'ramp' | 'step'>): number {
  const hex = DUEL_RAMPS[DUEL_RAMP_NAMES.indexOf(swatch.ramp)]?.[swatch.step]
  if (hex === undefined) throw new RangeError(`no colour at ${swatch.ramp} ${swatch.step}`)
  return Number.parseInt(hex.slice(1), 16)
}
