// A stand: an idle pose with attitude, the weight on one leg and each hand placed (FigureBuilder
// src/render/figure/motion.ts `Stand`, `HandPlace`, `Hang`; library/poses.json at a1f7246). The motion that
// places the hands on the outfit's openings is M3.5c's; this is the content shape. `fallback` names other
// stands, checked like every library reference.

import { contentRef } from '@automataframework/automata-content/schema'
import { z } from 'zod'
import { keyedUnion } from './keyed-union'
import { about, side, type Vec3, vec3 } from './shapes.schema'

export const HAND_PLACES = [
  'hip',
  'frontPocket',
  'thumbHook',
  'thighPocket',
  'bellyPocket',
  'jacketPocket',
  'crossed',
] as const

/** A hand placed on the body: an opening it goes to, nudged (m at 1.62 m: x out, y up, z forward), the elbow swung out. */
export interface HandPlace {
  readonly at: (typeof HAND_PLACES)[number]
  readonly nudge?: Vec3 | undefined
  readonly elbow?: number | undefined
}
/** A hanging arm: how far out from the body, the elbow's bend (rad), swung forward (+) or back. */
export interface Hang {
  readonly out: number
  readonly bend: number
  readonly swing?: number | undefined
}
export interface Stand {
  readonly about?: string | undefined
  /** Stands to try instead, in order, when this one's hands find no opening on the outfit. */
  readonly fallback?: readonly string[] | undefined
  /** The leg the weight is on. */
  readonly weight: 'L' | 'R'
  /** The hips shifted over the weight leg (m at 1.62 m), rolled up on its side and turned (rad). */
  readonly shift: number
  readonly roll: number
  readonly turn?: number | undefined
  /** The weight foot drawn in under the body (0 under its hip … 1 on the middle line), turned out (rad). */
  readonly under?: number | undefined
  readonly splay?: number | undefined
  /** The free foot: forward and out (m at 1.62 m), its toes turned out and its heel raised (rad). */
  readonly free: readonly number[]
  /** The chest's roll, turn and pitch against the hips; the head's turn, roll and nod (rad). */
  readonly chest?: Vec3 | undefined
  readonly head?: Vec3 | undefined
  readonly hands?:
    | { readonly L?: HandPlace | Hang | undefined; readonly R?: HandPlace | Hang | undefined }
    | undefined
}

const handPlace = z.strictObject({
  at: z.enum(HAND_PLACES),
  nudge: vec3.optional(),
  elbow: z.number().optional(),
})
const hang = z.strictObject({ out: z.number(), bend: z.number(), swing: z.number().optional() })
// Told apart by key, so a misspelt opening is reported at `at`, not as an invalid hand.
const hand = keyedUnion<HandPlace | Hang>('hand', { at: handPlace, out: hang })

export const standSchema: z.ZodType<Stand> = z.strictObject({
  about,
  fallback: z.array(contentRef('figure-stand')).optional(),
  weight: side,
  shift: z.number(),
  roll: z.number(),
  turn: z.number().optional(),
  under: z.number().min(0).max(1).optional(),
  splay: z.number().optional(),
  // [forward, out, splay?, heel?]
  free: z.array(z.number()).min(2).max(4),
  chest: vec3.optional(),
  head: vec3.optional(),
  hands: z.strictObject({ L: hand.optional(), R: hand.optional() }).optional(),
})
