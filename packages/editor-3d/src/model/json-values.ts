// Two small rules about the JSON values the edits write, shared so each is said once: when two values are the same, and
// what of an object the file writes.

/**
 * Whether two JSON values say the same, however deep and whatever the order of their members: numbers, names, lists
 * and objects. A parsed value lists its keys in schema order, the file in its own, so order cannot count.
 */
export function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false
  if (Array.isArray(a) || Array.isArray(b))
    return (
      Array.isArray(a) &&
      Array.isArray(b) &&
      a.length === b.length &&
      a.every((each, i) => sameJson(each, b[i]))
    )
  const [mine, theirs] = [a as Record<string, unknown>, b as Record<string, unknown>]
  const keys = Object.keys(mine)
  return (
    keys.length === Object.keys(theirs).length &&
    keys.every((key) => Object.hasOwn(theirs, key) && sameJson(mine[key], theirs[key]))
  )
}

/** An object as the file writes it: a member set to `undefined` is not written. */
export const withoutUndefined = <T extends object>(object: T): T =>
  Object.fromEntries(Object.entries(object).filter(([, value]) => value !== undefined)) as T
