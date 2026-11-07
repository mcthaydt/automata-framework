// Headwear and hair locks (`Lock`, `Headwear` and `Cap`). Locks are rounded boxes in head units, so a style fits any head the
// sliders make. The generators that build them live in the hair and outfit code; these are the content shapes.

import { contentRef } from '@automata/content/schema'
import { z } from 'zod'
import { about, type Line, line, type Vec2, type Vec3, vec2, vec3 } from './shapes.schema.ts'

/** One rounded box of hair or headwear, in head units (x of the head's half-width, y of its height above the
 * chin, z of its half-depth); `rk` and `atk` add metres scaled to the figure. */
export interface Lock {
  readonly on: 'head' | 'back' | 'sides'
  readonly at: Vec3
  readonly r: Vec3
  readonly rk?: Vec3 | undefined
  readonly e?: Vec2 | undefined
  readonly taper?: Vec2 | undefined
  readonly shear?: Vec2 | undefined
  readonly roll?: number | undefined
  readonly pitch?: number | undefined
  readonly follow?: number | undefined
  readonly cut?: { readonly below: number; readonly front: number } | undefined
}
/** A cap: its band round the head, crown, panels and brim (hair.ts `Cap`). */
export interface Cap {
  readonly band: Line
  readonly lift: number
  readonly crown: number
  readonly panels?: Vec2 | undefined
  readonly brim: {
    readonly at: number
    readonly width: number
    readonly reach: number
    readonly droop: number
    readonly curve?: number | undefined
    readonly thick?: number | undefined
    readonly sticker?: number | undefined
  }
  readonly gap?:
    | {
        readonly width: number
        readonly height: number /** A swatch id. */
        readonly strap?: string | undefined
      }
    | undefined
  readonly button?: number | undefined
}
/** Where headwear's mark goes (head units, `atk` metres), facing `normal`, with its sizes if more than one. */
export interface HeadwearMark {
  readonly at: Vec3
  readonly atk?: Vec3 | undefined
  readonly normal: Vec3
  readonly sizes?: readonly Vec2[] | undefined
}
export interface Headwear {
  readonly about?: string | undefined
  readonly locks?: readonly Lock[] | undefined
  readonly cap?: Cap | undefined
  readonly mark?: HeadwearMark | undefined
}

export const lockSchema: z.ZodType<Lock> = z.strictObject({
  on: z.enum(['head', 'back', 'sides']),
  at: vec3,
  r: vec3,
  rk: vec3.optional(),
  e: vec2.optional(),
  taper: vec2.optional(),
  shear: vec2.optional(),
  roll: z.number().optional(),
  pitch: z.number().optional(),
  follow: z.number().optional(),
  cut: z.strictObject({ below: z.number(), front: z.number() }).optional(),
})

const capSchema: z.ZodType<Cap> = z.strictObject({
  band: line,
  lift: z.number(),
  crown: z.number(),
  panels: vec2.optional(),
  brim: z.strictObject({
    at: z.number(),
    width: z.number(),
    reach: z.number(),
    droop: z.number(),
    curve: z.number().optional(),
    thick: z.number().optional(),
    sticker: z.number().optional(),
  }),
  gap: z
    .strictObject({ width: z.number(), height: z.number(), strap: contentRef('figure-swatch').optional() })
    .optional(),
  button: z.number().optional(),
})

export const headwearSchema: z.ZodType<Headwear> = z
  .strictObject({
    about,
    locks: z.array(lockSchema).min(1).optional(),
    cap: capSchema.optional(),
    mark: z
      .strictObject({ at: vec3, atk: vec3.optional(), normal: vec3, sizes: z.array(vec2).optional() })
      .optional(),
  })
  .refine((h) => h.locks !== undefined || h.cap !== undefined, { message: 'headwear needs locks or a cap' })
