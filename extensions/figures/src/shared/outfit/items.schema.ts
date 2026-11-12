import { z } from 'zod'
import { asWritten } from '../math/as-written'

const n = z.number()
const v3 = z.tuple([n, n, n])

/** An item as data (library/items.json): its parts in the socket's space and the hold. The reader types what this returns as `ItemDef`, which is the check that the schema's output fits it; the schema does not import the reader's type (that is a cycle the layer test refuses). */
export const itemSchema = z.strictObject({
  about: z.string().optional(),
  parts: z.array(
    z.strictObject({
      material: z.string(),
      at: v3,
      r: v3,
      e: z.tuple([n, n]).optional(),
      seg: n.optional(),
      rings: n.optional(),
      pitch: n.optional(),
      taper: z.tuple([n, n]).optional(),
    }),
  ),
  hold: z.strictObject({
    hand: z.array(z.strictObject({ k: n.optional(), shoulders: n.optional(), arms: n.optional() })),
    turn: v3,
    pole: v3,
  }),
})

/** The whole file: items by id. */
export const itemsSchema = asWritten(z.record(z.string(), itemSchema))
