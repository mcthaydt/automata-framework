// Facts and conditions: one owner, puzzle. Narrative's and systems' conditions are these, imported.
import { z } from 'zod'

export type Value = boolean | number | string

export const valueSchema: z.ZodType<Value> = z.union([z.boolean(), z.number(), z.string()])

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
