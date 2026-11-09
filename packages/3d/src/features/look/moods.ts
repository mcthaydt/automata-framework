// A mood grades the frame in OKLab: lightness scaled, a shift in a and b, a pull toward a colour, chroma scaled, each
// DUEL colour moved and snapped back to DUEL. The grade of a frame is then one table of 256 entries, which the finish
// pass applies to every pixel it draws, so a mood costs a lookup however big the field is.

import { z } from 'zod'
import { oklab, rgbFromLab } from '../../shared/math/colour.ts'
import { DUEL, duel } from '../../shared/math/duel.ts'
import moods from './library/moods.json' with { type: 'json' }

/** A lightness scale, a shift in OKLab a and b, a pull toward a colour (L, a, b, how far), a chroma scale. */
export interface Mood {
  readonly L: number
  readonly a: number
  readonly b: number
  readonly pull?: readonly [number, number, number, number] | undefined
  readonly chroma: number
}

const moodSchema: z.ZodType<Mood, unknown> = z.strictObject({
  L: z.number().positive(),
  a: z.number(),
  b: z.number(),
  pull: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
  chroma: z.number().min(0),
})

/** The moods the core look names. */
export const MOODS: Readonly<Record<string, Mood>> = z.record(z.string(), moodSchema).parse(moods)

/** For each DUEL colour (by index) the index of the colour a mood moves it to; no mood moves none. */
export function moodRemap(mood: Mood | undefined): Uint8Array {
  const out = new Uint8Array(DUEL.length)
  DUEL.forEach((entry, i) => {
    if (mood === undefined) {
      out[i] = i
      return
    }
    let [L, A, B] = oklab(entry.c)
    A *= mood.chroma
    B *= mood.chroma
    L *= mood.L
    A += mood.a
    B += mood.b
    if (mood.pull !== undefined) {
      const [, pa, pb, amount] = mood.pull
      A += (pa - A) * amount
      B += (pb - B) * amount
    }
    const to = duel(rgbFromLab(L, A, B))
    out[i] = DUEL.findIndex((d) => d.c === to)
  })
  return out
}
