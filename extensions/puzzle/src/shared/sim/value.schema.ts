// Facts and conditions: one owner, puzzle. Narrative's and systems' conditions are these, imported.
import { z } from 'zod'

/** A fact's value: a yes-or-no, a number or text. */
export type Value = boolean | number | string

/** The Zod schema of a fact's value. */
export const valueSchema: z.ZodType<Value> = z.union([z.boolean(), z.number(), z.string()])

/**
 * A condition on the puzzle's state. It asks that a fact is a value or within `atLeast` and
 * `atMost`, that an item is carried (`has`), that another condition does not hold (`not`), or that
 * any of a list holds (`any`).
 */
export type Cond =
  | {
      readonly fact: string
      readonly is?: Value | undefined
      readonly atLeast?: number | undefined
      readonly atMost?: number | undefined
    }
  | { readonly has: string }
  | { readonly not: Cond }
  | { readonly any: readonly Cond[] }

/** The Zod schema of a condition. */
export const condSchema: z.ZodType<Cond> = z.lazy(() =>
  z.union([
    z.strictObject({
      fact: z.string(),
      is: valueSchema.optional(),
      atLeast: z.number().optional(),
      atMost: z.number().optional(),
    }),
    z.strictObject({ has: z.string() }),
    z.strictObject({ not: condSchema }),
    z.strictObject({ any: z.array(condSchema) }),
  ]),
) as z.ZodType<Cond>
