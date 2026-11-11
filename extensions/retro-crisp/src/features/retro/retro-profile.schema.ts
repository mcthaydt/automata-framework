// The retro pass's settings: a colour grade, an unsharp mask, a vignette, a film fade (black lifted toward a tint, grain,
// dust and a scratch) and, for a look with no palette snap, an ordered-dither quantise. One profile, Zod-checked, with the
// clinic's numbers as the defaults. The look's own DUEL snap and its dither stay core's; this pass runs after them.

import { z } from 'zod'

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'a colour is #rrggbb')

const gradeSchema = z.strictObject({
  /** In stops: +1 doubles the light. */
  exposure: z.number().default(0),
  /** Cool (negative) to warm. */
  warmth: z.number().default(-0.12),
  /** Magenta (negative) to green. */
  tint: z.number().default(0.08),
  /** Lifts what is dark, by how far from white it is. */
  brilliance: z.number().default(0),
  contrast: z.number().min(0, 'contrast is 0 or more').default(1.05),
  highlights: z.number().default(-0.05),
  shadows: z.number().default(0),
  saturation: z.number().min(0, 'saturation is 0 or more').default(0.85),
  /** Saturates the dull colours more than the vivid. */
  vibrance: z.number().default(0.1),
  /** Colours darker than this luma go grey. */
  blackCrush: z.number().min(0, 'blackCrush is 0 to 1').max(1, 'blackCrush is 0 to 1').default(0.025),
  /** How much of the grade is kept, 0 to 1: under 1 it blends back toward the ungraded colour. */
  moodBlend: z.number().min(0, 'moodBlend is 0 to 1').max(1, 'moodBlend is 0 to 1').default(0.85),
})

const fadeSchema = z.strictObject({
  /** The tint black lifts toward (the haze's colour). */
  colour: hex.default('#4b5a56'),
  /** Black becomes this share of `colour`. 0 leaves black black. */
  lift: z.number().min(0, 'lift is 0 to 1').max(1, 'lift is 0 to 1').default(0.13),
  /** White settles here. 1 leaves white white. */
  white: z.number().min(0, 'white is 0 to 1').max(1, 'white is 0 to 1').default(0.96),
  /** Film grain's amplitude. */
  grain: z.number().min(0, 'grain is 0 or more').default(0.04),
  /** The film's frame rate: the grain and dust change this many times a second. */
  fps: z.number().positive('fps is above 0').default(12),
  /** Dust speck size, in cells. */
  speck: z.number().positive('speck is above 0').default(3),
  /** The share of specks lit each frame. */
  specks: z.number().min(0, 'specks is 0 to 1').max(1, 'specks is 0 to 1').default(0.0008),
  /** The share of frames with a faint vertical scratch. */
  scratch: z.number().min(0, 'scratch is 0 to 1').max(1, 'scratch is 0 to 1').default(0.25),
})

const quantiseSchema = z.strictObject({
  /** Levels a channel is cut into. */
  levels: z.number().int('levels is a whole number').min(2, 'levels is at least 2').default(8),
  /** How much the dither threshold follows luma. */
  lumaWeight: z.number().min(0, 'lumaWeight is 0 to 1').max(1, 'lumaWeight is 0 to 1').default(0.5),
})

export const retroProfileSchema = z.strictObject({
  /** Unsharp mask strength, from a 4-tap cross. 0 leaves it out. */
  sharpness: z.number().min(0, 'sharpness is 0 or more').default(0.35),
  grade: gradeSchema.default(() => gradeSchema.parse({})),
  /** How dark the corners go, 0 to 1. 0 leaves the frame even. */
  vignette: z.number().min(0, 'vignette is 0 to 1').max(1, 'vignette is 0 to 1').default(0.85),
  fade: fadeSchema.default(() => fadeSchema.parse({})),
  /** An ordered-dither quantise for a look with no palette snap. `null` (the default) leaves the colours as the grade makes them. */
  quantise: quantiseSchema.nullable().default(null),
  /** Pixels a side of the grain and dust cell (2 on a phone's coarser field). */
  cell: z.number().int('cell is a whole number of pixels').min(1, 'cell is at least 1 pixel').default(1),
})

export type RetroProfile = z.output<typeof retroProfileSchema>
export type RetroGrade = RetroProfile['grade']

/** Reads a profile, filling what is left out with the clinic's numbers. Throws a `ZodError` naming the setting that is wrong. */
export const parseRetroProfile = (input: unknown): RetroProfile => retroProfileSchema.parse(input)

/** The clinic's retro look: every default. */
export const RETRO_CLINIC: RetroProfile = parseRetroProfile({})

/**
 * A profile that changes nothing: an exact DUEL colour comes out as it went in. The grade is blended in at 0, so the
 * ungraded colour is returned as it is (a grade at its identity values still rounds a channel by a unit in the last place).
 */
export const RETRO_NEUTRAL: RetroProfile = parseRetroProfile({
  sharpness: 0,
  grade: {
    exposure: 0,
    warmth: 0,
    tint: 0,
    brilliance: 0,
    contrast: 1,
    highlights: 0,
    shadows: 0,
    saturation: 1,
    vibrance: 0,
    blackCrush: 0,
    moodBlend: 0,
  },
  vignette: 0,
  fade: { lift: 0, white: 1, grain: 0, specks: 0, scratch: 0 },
})
