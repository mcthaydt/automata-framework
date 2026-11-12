import { z } from 'zod'
import { asWritten } from '../math/as-written'
import type { Seat } from './motion'

const n = z.number()
const v3 = z.tuple([n, n, n])
/** A seated hand: in the lap, hanging, or on a point (with the fingers' and the palm's aim). */
const seatHand = z.union([
  z.literal('lap'),
  z.literal('hang'),
  z.strictObject({ to: v3, aim: z.tuple([v3, v3]).optional() }),
])

/** A seat (library/seats.json): how a figure sits, the hands on it, and the typing's bob. */
export const seatSchema = z.strictObject({
  about: z.string().optional(),
  height: n,
  knees: n.optional(),
  feet: n.optional(),
  lean: n.optional(),
  slump: n.optional(),
  turn: n.optional(),
  roll: n.optional(),
  head: v3.optional(),
  hands: z.strictObject({ L: seatHand.optional(), R: seatHand.optional() }).optional(),
  type: n.optional(),
}) satisfies z.ZodType<Seat>

/** The whole file: seats by name. */
export const seatsSchema = asWritten(z.record(z.string(), seatSchema))
