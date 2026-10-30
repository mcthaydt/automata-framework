// A union told apart by which key an object has: a garment is `{ coat = "navy" … }` or `{ top = "starch" … }`,
// a hair piece `{ scalp = { … } }` or `{ rows = { … } }`. FigureBuilder writes them that way (garments.ts
// `Garment`, hair.ts `Piece`). zod's union reports a failed member as one "Invalid input" at the whole object;
// choosing the member by its key first keeps each problem at its own field, so content diagnostics point at
// the line to fix.

import { z } from 'zod'

/**
 * Parses an object with the schema of the first key of `members` it has, in `members` order. An object with
 * none of them is refused, naming the keys it could have.
 */
export function keyedUnion<T>(what: string, members: Readonly<Record<string, z.ZodType<T>>>): z.ZodType<T> {
  const keys = Object.keys(members)
  return z.unknown().transform((value, ctx): T => {
    const key =
      typeof value === 'object' && value !== null && !Array.isArray(value)
        ? keys.find((candidate) => Object.hasOwn(value, candidate))
        : undefined
    const member = key === undefined ? undefined : members[key]
    if (member === undefined) {
      ctx.issues.push({ code: 'custom', input: value, message: `a ${what} has one of: ${keys.join(', ')}` })
      return z.NEVER
    }
    const parsed = member.safeParse(value)
    if (parsed.success) return parsed.data
    // The member's issues, with their paths, become this field's: zod prefixes the path of the field being
    // parsed, so a wrong number inside a garment is reported at that number's own key.
    for (const issue of parsed.error.issues)
      ctx.issues.push({ ...issue, input: value } as z.core.$ZodRawIssue)
    return z.NEVER
  }) as unknown as z.ZodType<T>
}
