import { z } from 'zod'
import { asWritten } from '../math/as-written'

/** A time of day (library/times.json): the exposure, the ambient's colour and the tint it casts. The reader types what this returns as `TimeOfDay`, which is the check that the schema's output fits it; the schema does not import the reader's type (that is a cycle the layer test refuses). */
export const timeSchema = z.strictObject({
  exposure: z.number(),
  figureLift: z.number().optional(),
  ambient: z.string(),
  tint: z.number(),
  key: z.tuple([z.number(), z.number(), z.number()]).optional(),
})

/** The whole file: the times by name. */
export const timesSchema = asWritten(z.record(z.string(), timeSchema))
