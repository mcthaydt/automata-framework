// A library id or the value written inline: `gait = "bounce"` or `gait = { cycle = 0.5 … }`, a hair style's id,
// its locks as an array, or a whole style. As with keyedUnion, zod's union would report a broken inline value
// as one "Invalid input" at the field; choosing the branch by the value's type first keeps each problem at its
// own key, so a hood lock missing its size is reported at that lock's `r`.

import { contentRef } from '@mcthaydt/automata-content/schema'
import { z } from 'zod'

/** The inline forms a field takes: an object (a table in TOML), an array, or both. */
export interface InlineForms<T> {
  readonly object?: z.ZodType<T>
  readonly array?: z.ZodType<T>
}

/** A string is an id of `kind` (checked like every reference); an object or array is parsed by its form. */
export function refOrInline<T>(kind: string, inline: InlineForms<T>): z.ZodType<string | T> {
  const ref = contentRef(kind)
  const forms = [inline.object && 'a table', inline.array && 'an array'].filter(Boolean).join(' or ')
  return z.unknown().transform((value, ctx): string | T => {
    const schema =
      typeof value === 'string'
        ? ref
        : Array.isArray(value)
          ? inline.array
          : typeof value === 'object' && value !== null
            ? inline.object
            : undefined
    if (schema === undefined) {
      ctx.issues.push({ code: 'custom', input: value, message: `expected a ${kind} id or ${forms}` })
      return z.NEVER
    }
    const parsed = schema.safeParse(value)
    if (parsed.success) return parsed.data
    // The branch's issues keep their paths, below the field being parsed.
    for (const issue of parsed.error.issues)
      ctx.issues.push({ ...issue, input: value } as z.core.$ZodRawIssue)
    return z.NEVER
  }) as unknown as z.ZodType<string | T>
}
