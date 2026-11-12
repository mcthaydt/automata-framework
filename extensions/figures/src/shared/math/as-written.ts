import { z } from 'zod'

/**
 * Checks a library file with `schema` and hands the file back as it was written. A strict object comes out of Zod with its
 * keys in the schema's order, but an entry's fields are written in the order that reads best, and a library's order is its
 * author's (the order of the entries and of every array seeds the painter), so what the reader keeps is the data itself,
 * not a rebuilt copy. A key the schema does not know is an error naming it, as `z.strictObject` has it.
 */
export const asWritten = <T extends z.ZodType>(schema: T) =>
  z.unknown().transform((raw, ctx): z.output<T> => {
    const checked = schema.safeParse(raw)
    if (checked.success) return raw as z.output<T>
    ctx.addIssue({ code: 'custom', message: checked.error.message })
    return z.NEVER
  })
