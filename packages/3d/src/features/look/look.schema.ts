// The look's settings (content-shaped: the view's half of a game's look): how small the field is, how many steps light is cut into, the outline's edge, the dither and which
// passes are on. Presentation only: the sim never reads it (law 1). Stars, rain and bloom are the world kit's passes,
// each with a switch of its own, so they are not named here.

import { z } from 'zod'

/** The passes the core look can switch. */
export interface LookSwitches {
  readonly outline: boolean
  readonly grade: boolean
  readonly dither: boolean
}

export interface Look {
  /** The field's short side in pixels: the long side follows the stage (`targetSize`). */
  readonly pixel: { readonly short: number }
  /** Whole steps light is cut into, 0 to 1: the lit surface takes one of `steps` levels. */
  readonly steps: number
  /** An outline is drawn where depth jumps by more than `edge` of the nearer surface's depth. */
  readonly outline: { readonly edge: number }
  /** The Bayer offset (in colour units, 0 to 1) a pixel gets before it snaps to DUEL. */
  readonly dither: { readonly strength: number }
  /** Where the grade comes from: the time of day's, or none. */
  readonly grade: 'time' | 'none'
  readonly switches: LookSwitches
}

export const lookSchema: z.ZodType<Look, unknown> = z.strictObject({
  pixel: z
    .strictObject({ short: z.number().int().min(1, 'the short side of the field is at least 1 pixel') })
    .default({ short: 180 }),
  steps: z.number().int().min(2, 'light is cut into at least 2 steps').default(5),
  outline: z.strictObject({ edge: z.number().min(0).max(1) }).default({ edge: 0.35 }),
  dither: z.strictObject({ strength: z.number().min(0).max(1) }).default({ strength: 0.04 }),
  grade: z.enum(['time', 'none']).default('time'),
  switches: z
    .strictObject({
      outline: z.boolean().default(false),
      grade: z.boolean().default(true),
      dither: z.boolean().default(true),
    })
    .default({ outline: false, grade: true, dither: true }),
})
