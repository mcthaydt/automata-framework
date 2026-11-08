// A held item: its parts in its socket's space, where its tip (a flame, a light) sits, and the hold that
// poses the arm (FigureBuilder src/render/figure/cast.ts `ItemDef`, library/items.json at a1f7246). A part's
// `material` is a swatch id. The parts become meshes in M3.5b; the hold is applied in M3.5c.

import { contentRef } from '@mcthaydt/automata-content/schema'
import { z } from 'zod'
import { about, type Vec2, type Vec3, vec2, vec3 } from './shapes.schema'

/** One rounded box, in metres in socket space (+z up when held upright). */
export interface ItemPart {
  readonly material: string
  readonly at: Vec3
  readonly r: Vec3
  readonly e?: Vec2 | undefined
  readonly seg?: number | undefined
  readonly rings?: number | undefined
  readonly pitch?: number | undefined
}
/** A sum of the figure's measures: k (height / 1.62), the shoulders' half-width and the arm's length. */
export interface Measures {
  readonly k?: number | undefined
  readonly shoulders?: number | undefined
  readonly arms?: number | undefined
}
export interface Hold {
  /** The hand's place in the chest's space, each axis a sum of measures; mirrored in x for the left hand. */
  readonly hand: readonly [Measures, Measures, Measures]
  /** The hand's turn (pitch, yaw, roll, rad) and the elbow's pole. */
  readonly turn: Vec3
  readonly pole: Vec3
}
export interface ItemDef {
  readonly about?: string | undefined
  readonly parts: readonly ItemPart[]
  readonly tip?: Vec3 | undefined
  readonly hold: Hold
}

const count = z.number().int().positive()
const measures = z.strictObject({
  k: z.number().optional(),
  shoulders: z.number().optional(),
  arms: z.number().optional(),
})

export const itemSchema: z.ZodType<ItemDef> = z.strictObject({
  about,
  parts: z
    .array(
      z.strictObject({
        material: contentRef('figure-swatch'),
        at: vec3,
        r: vec3,
        e: vec2.optional(),
        seg: count.optional(),
        rings: count.optional(),
        pitch: z.number().optional(),
      }),
    )
    .min(1),
  tip: vec3.optional(),
  hold: z.strictObject({ hand: z.tuple([measures, measures, measures]), turn: vec3, pole: vec3 }),
})
