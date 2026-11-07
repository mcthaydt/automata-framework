// A seat: a seated stand, the hips on a seat of some height, the thighs forward over it, the back leaning or slumped,
// the head on it and each hand in the lap, hanging, or on a desk (FigureBuilder src/features/motion/motion.ts `Seat`,
// `SeatHand`; library/seats.json at 025ffb4). The pose that sits a body down is `seated` (seated.ts).

import { type Vec3, vec3 } from '@automata/3d/figures-kit'
import { z } from 'zod'

/** A seated hand: in the lap (on the near thigh, by the knee), hanging, or on a desk at `to`. */
export type SeatHand =
  | 'lap'
  | 'hang'
  | {
      /** The desk point in the root's space: x out from the middle, y up, z forward (m). */
      readonly to: Vec3
      /** Where the fingers point and the palm faces, if not the desk's default. */
      readonly aim?: readonly [fingers: Vec3, palm: Vec3] | undefined
    }

/**
 * A seated stand: the hips on a seat `height` off the floor (m), the thighs forward over it, the knees `knees` apart past
 * the hips and the feet planted `feet` forward of under the knees (m at scale 1; back tucks them under the seat). The back
 * leans `lean` forward from the hips (rad) or `slump`s (0 to 1: the pelvis rolls back and slides forward on the seat, the
 * spine rounds, the chest sinks), turned and rolled; the head on it, its chin kept level to whatever the chest leans, so the
 * eyes stay on what is ahead. Each hand: in the lap, on a desk at `to`, hanging, or tapping (`type`, its bob in m).
 */
export interface Seat {
  readonly about?: string | undefined
  readonly height: number
  readonly knees?: number | undefined
  readonly feet?: number | undefined
  readonly lean?: number | undefined
  readonly slump?: number | undefined
  readonly turn?: number | undefined
  readonly roll?: number | undefined
  /** The head's yaw, roll and pitch on the seat (rad). */
  readonly head?: Vec3 | undefined
  readonly hands?: { readonly L?: SeatHand | undefined; readonly R?: SeatHand | undefined } | undefined
  /** Typing: each hand on its desk point bobs this far (m), the two out of step. */
  readonly type?: number | undefined
}

const hand: z.ZodType<SeatHand> = z.union([
  z.enum(['lap', 'hang']),
  z.strictObject({ to: vec3, aim: z.tuple([vec3, vec3]).optional() }),
])

export const seatSchema: z.ZodType<Seat> = z.strictObject({
  about: z.string().min(1).optional(),
  height: z.number().positive(),
  knees: z.number().optional(),
  feet: z.number().optional(),
  lean: z.number().optional(),
  slump: z.number().min(0).max(1).optional(),
  turn: z.number().optional(),
  roll: z.number().optional(),
  head: vec3.optional(),
  hands: z.strictObject({ L: hand.optional(), R: hand.optional() }).optional(),
  type: z.number().optional(),
})
