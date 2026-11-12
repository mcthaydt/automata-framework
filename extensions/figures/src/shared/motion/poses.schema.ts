import { z } from 'zod'
import { asWritten } from '../math/as-written'
import type { Stand } from './motion'

const n = z.number()
const v3 = z.tuple([n, n, n])
const side = z.enum(['L', 'R'])

/** A hand's place on the clothes: one of the anchors the outfit offers, nudged and with the elbow's bend. */
const handPlace = z.strictObject({
  at: z.enum(['hip', 'frontPocket', 'thumbHook', 'thighPocket', 'bellyPocket', 'jacketPocket', 'crossed']),
  nudge: v3.optional(),
  elbow: n.optional(),
})
/** A hand that hangs: out from the hip, bent, and the swing's share. */
const hang = z.strictObject({ out: n, bend: n, swing: n.optional() })

/** A stand (library/poses.json): where the weight rests and where each hand goes. */
export const standSchema = z.strictObject({
  about: z.string().optional(),
  fallback: z.array(z.string()).optional(),
  weight: side,
  shift: n,
  roll: n,
  turn: n.optional(),
  under: n.optional(),
  splay: n.optional(),
  free: z.tuple([n, n, n.optional(), n.optional()]),
  chest: v3.optional(),
  head: v3.optional(),
  hands: z
    .strictObject({ L: z.union([handPlace, hang]).optional(), R: z.union([handPlace, hang]).optional() })
    .optional(),
}) satisfies z.ZodType<Stand>

/** The whole file: stands by name. */
export const posesSchema = asWritten(z.record(z.string(), standSchema))
