// The crisp settings: how the picture reaches the screen without a texel or a pixel being smeared or drawn at an uneven
// width. `scale` is the whole-pixel letterbox or the one fractional fit; `figures`, `lcd` and `sampler` are look
// changes, off until a game asks. Zod-checked, with the clinic's numbers as the defaults.

import { z } from 'zod'

export const crispProfileSchema = z.strictObject({
  /** `letterbox`: a whole number of device pixels per field pixel. `fit`: one fractional scale (uneven pixel widths). */
  scale: z.enum(['letterbox', 'fit']).default('letterbox'),
  /** The field's largest size, in pixels. */
  cap: z
    .strictObject({
      width: z.number().int('width is a whole number of pixels').min(1, 'width is at least 1 pixel'),
      height: z.number().int('height is a whole number of pixels').min(1, 'height is at least 1 pixel'),
    })
    .default({ width: 640, height: 480 }),
  /** Each billboard figure is drawn at a whole number of field pixels per texel (`figureSnap`). */
  figures: z.boolean().default(false),
  /** The LCD panel's colour split lands on whole pixels: set `snap` on its profile from this. */
  lcd: z.boolean().default(false),
  /** Sample sprite textures nearest. */
  sampler: z.boolean().default(false),
})

export type CrispProfile = z.output<typeof crispProfileSchema>

/** Reads a profile, filling what is left out with the clinic's numbers. Throws a `ZodError` naming the setting that is wrong. */
export const parseCrispProfile = (input: unknown): CrispProfile => crispProfileSchema.parse(input)

/** The clinic's crisp: whole-pixel scaling, every look change off. */
export const CRISP_CLINIC: CrispProfile = parseCrispProfile({})

/**
 * A profile from a page's query: `?crisp=figures`, `?crisp=1` (figures and sampler), `?crisp=figures,lcd`, and
 * `?scale=fit|letterbox`. A word it does not know is ignored.
 */
export function crispFromQuery(search: string): CrispProfile {
  const query = new URLSearchParams(search)
  const parts = (query.get('crisp') ?? '').split(',')
  const has = (part: string): boolean => parts.includes('1') || parts.includes(part)
  const scale = query.get('scale')
  return parseCrispProfile({
    scale: scale === 'fit' || scale === 'letterbox' ? scale : undefined,
    figures: has('figures'),
    lcd: parts.includes('lcd'),
    sampler: has('sampler'),
  })
}
