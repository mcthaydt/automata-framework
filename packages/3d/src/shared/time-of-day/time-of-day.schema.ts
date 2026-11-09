// A time of day (content kind `time-of-day`): the light a scene and the figures in it are drawn in. One entry holds
// what both builders kept apart: the scene's light, sky, haze and grade, and the figure's key and steps down its
// ramps. Presentation only: the sim never reads it (law 1). Colours are `#rrggbb`, as in both sources and in the
// editors; the look turns them into ramp steps. Its id is its file's name, like every collection kind's.

import { z } from 'zod'

/** The figures' painted key, toward its source in view space: what a time that names none uses. */
export const FIGURE_KEY: readonly [number, number, number] = [-0.5, 0.62, 0.6]

const colour = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'a colour is # and six hex digits, like #c7d6ff')
const level = z.number().min(0).max(1)
const tinted = z.strictObject({ level, tint: colour })

const light = z.strictObject({
  /** Whether lamps and the sun cast shadows by this time. */
  shadow: z.boolean(),
  ambient: tinted,
  fill: tinted,
  sun: z.strictObject({ level, colour }).optional(),
})
const scene: z.ZodType<Scene> = z.strictObject({
  light,
  /** The sky from its top (0) down to the horizon, as colour stops. */
  sky: z.array(z.strictObject({ colour, at: level })).min(1),
  /** Distance haze: the colour far things fade to, and how much. */
  haze: z.strictObject({ colour, amount: level }).optional(),
  /** Stars, as how thick the sky is with them (0 none). */
  stars: z.number().min(0).max(1).optional(),
  /** What everything lit is tinted toward, and how far (0 to 1): the ambient colour of the time. */
  grade: z.strictObject({ tint: colour, amount: level }),
})
const figure: z.ZodType<Figure> = z.strictObject({
  /** Whole steps a figure sits down its ramps (night is -2). */
  exposure: z.number().int().default(0),
  /** The steps the cast stands brighter than that, the value contrast games light their cast with. */
  lift: z.number().int().default(0),
  /** Toward the key light, in view space (x right, y up, z toward the camera). */
  key: z.tuple([z.number(), z.number(), z.number()]).default([...FIGURE_KEY]),
})

export const timeOfDaySchema: z.ZodType<TimeOfDayEntry> = z.strictObject({
  /** The words the editor shows: Day, Golden hour, Dusk, Night, Lamplight, Bar light. */
  label: z.string().min(1),
  scene,
  figure: figure.prefault({}),
})

interface Scene {
  readonly light: {
    readonly shadow: boolean
    readonly ambient: { readonly level: number; readonly tint: string }
    readonly fill: { readonly level: number; readonly tint: string }
    readonly sun?: { readonly level: number; readonly colour: string } | undefined
  }
  readonly sky: readonly { readonly colour: string; readonly at: number }[]
  readonly haze?: { readonly colour: string; readonly amount: number } | undefined
  readonly stars?: number | undefined
  readonly grade: { readonly tint: string; readonly amount: number }
}
interface Figure {
  readonly exposure: number
  readonly lift: number
  readonly key: readonly [number, number, number]
}

/** A time of day as the content holds it, before it has a name. */
export interface TimeOfDayEntry {
  readonly label: string
  readonly scene: Scene
  readonly figure: Figure
}
