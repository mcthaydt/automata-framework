// The look's settings (content-shaped: the view's half of a game's look): how small the field is, how many steps light is
// cut into, the outline's edge, the dither, the mood and which passes are on. Presentation only: the sim never reads it (law 1).

import { z } from 'zod'
import type { Haze } from '../../shared/render/texel.ts'

/** The passes the core look can switch. */
export interface LookSwitches {
  readonly outline: boolean
  readonly grade: boolean
  readonly dither: boolean
  /** Lamps and bright things glow into what is round them. */
  readonly glow: boolean
  readonly rain: boolean
  readonly stars: boolean
  /** A wet floor takes a lamp's reflection. */
  readonly reflect: boolean
  readonly shafts: boolean
  readonly particles: boolean
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
  /** A named mood the whole frame is graded by, in OKLab, after the snap (`moods.ts`); none leaves the palette as it is. */
  readonly mood?: string | undefined
  readonly switches: LookSwitches
  /** The painted figures' cells: the density they are painted at, in quarter steps between `min` and `max` texels of the
   * sheets' size, and the bytes the cell cache may hold. */
  readonly figures: { readonly min: number; readonly max: number; readonly cacheBytes: number }
  /** The light: the room's light is cut into multiples of `step`, scaled by `gain` and never over `max` a channel. */
  readonly light: { readonly step: number; readonly gain: number; readonly max: number }
  /** The veil far things sink into. */
  readonly haze: Haze
  /** How a figure steps in its light (the sprite light's rules) and how much of the room's ambient it takes. */
  readonly figureLight: {
    readonly ambient: number
    readonly threshold: number
    readonly ink: number
    readonly floor: number
    readonly rim: number
    readonly floorCap: number
  }
  /** How dark a figure's shadow is on the floor, 0 to 1 of the colour under it. */
  readonly figureShadow: number
}

export const lookSchema: z.ZodType<Look, unknown> = z.strictObject({
  pixel: z
    .strictObject({ short: z.number().int().min(1, 'the short side of the field is at least 1 pixel') })
    .default({ short: 360 }),
  steps: z.number().int().min(2, 'light is cut into at least 2 steps').default(5),
  outline: z.strictObject({ edge: z.number().min(0).max(1) }).default({ edge: 0.35 }),
  dither: z.strictObject({ strength: z.number().min(0).max(1) }).default({ strength: 0.04 }),
  grade: z.enum(['time', 'none']).default('time'),
  mood: z.string().min(1).optional(),
  switches: z
    .strictObject({
      outline: z.boolean().default(false),
      grade: z.boolean().default(true),
      dither: z.boolean().default(true),
      glow: z.boolean().default(true),
      rain: z.boolean().default(true),
      stars: z.boolean().default(true),
      reflect: z.boolean().default(true),
      shafts: z.boolean().default(true),
      particles: z.boolean().default(true),
    })
    .default({
      outline: false,
      grade: true,
      dither: true,
      glow: true,
      rain: true,
      stars: true,
      reflect: true,
      shafts: true,
      particles: true,
    }),
  figures: z
    .strictObject({
      min: z.number().min(1, 'a cell is at least the sheets’ density').default(1),
      max: z.number().min(1).default(3),
      cacheBytes: z.number().int().min(1).default(33554432),
    })
    .default({ min: 1, max: 3, cacheBytes: 33554432 }),
  light: z
    .strictObject({
      step: z.number().positive('light is cut into steps above 0'),
      gain: z.number().positive(),
      max: z.number().positive(),
    })
    .default({ step: 0.1, gain: 1, max: 1.6 }),
  haze: z
    .strictObject({
      colour: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'the haze colour is #rrggbb'),
      near: z.number().min(0),
      far: z.number().positive(),
      amount: z.number().min(0).max(1),
      glow: z.number().min(0),
    })
    .refine((haze) => haze.far > haze.near, { message: 'the haze ends past where it starts', path: ['far'] })
    .default({ colour: '#47655a', near: 0, far: 10, amount: 0.85, glow: 0.5 }),
  figureLight: z
    .strictObject({
      ambient: z.number().min(0),
      threshold: z.number().min(0).max(1),
      ink: z.number().int().min(0).max(255),
      floor: z.number().min(0),
      rim: z.number().min(0).max(1),
      floorCap: z.number().min(0),
    })
    .default({ ambient: 1.5, threshold: 0.22, ink: 40, floor: 0.5, rim: 0.35, floorCap: 0.8 }),
  figureShadow: z.number().min(0).max(1).default(0.6),
})
