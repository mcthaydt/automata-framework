// Checking a patch: why one is refused, the rules for whether a text reads as the model it should, and the guard
// that `patchJson` runs on every result before returning it.
import type { JsonPath } from './locate'
import { BLOCKOUT_NUMBERS, JsonWriteError, type NumberStyle } from './print'
import type { JsonValue } from './shape'

export type PatchRefusalReason = 'unwritable-value' | 'invalid-text' | 'before-mismatch' | 'verify-failed'

export type PatchResult =
  | { readonly ok: true; readonly text: string }
  | {
      readonly ok: false
      readonly path: JsonPath
      readonly reason: PatchRefusalReason
      readonly detail: string
    }

export type Json = JsonValue | undefined

export const isObject = (value: unknown): value is Record<string, Json> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

/** The keys of an object that hold a value: a member set to `undefined` is no member (as in `JSON.stringify`). */
export const keysOf = (object: Record<string, Json>): string[] =>
  Object.keys(object).filter((key) => object[key] !== undefined)

export const refuse = (path: JsonPath, reason: PatchRefusalReason, detail: string): PatchResult => ({
  ok: false,
  path,
  reason,
  detail,
})

/**
 * The first path, in document order, where `actual` and `expected` differ, or undefined when they are the same value
 * (key order aside). With `rounded` (a number style), a number matches when it is the expected one or the expected one as the file
 * writes it.
 */
export function firstDifference(
  actual: Json,
  expected: Json,
  rounded: NumberStyle | undefined,
  path: JsonPath = [],
): JsonPath | undefined {
  if (typeof actual === 'number' && typeof expected === 'number') {
    return actual === expected || (rounded !== undefined && actual === rounded.round(expected))
      ? undefined
      : path
  }
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) return path
    for (const [i, item] of actual.entries()) {
      const found = firstDifference(item, expected[i], rounded, [...path, i])
      if (found) return found
    }
    return undefined
  }
  if (isObject(actual) && isObject(expected)) {
    const keys = keysOf(actual)
    const stray = [...keys, ...keysOf(expected)].find(
      (key) => (actual[key] === undefined) !== (expected[key] === undefined),
    )
    if (stray !== undefined) return [...path, stray]
    for (const key of keys) {
      const found = firstDifference(actual[key], expected[key], rounded, [...path, key])
      if (found) return found
    }
    return undefined
  }
  return actual === expected ? undefined : path
}

/** The first value in `after` that cannot be written as JSON the way these files write it, with why. */
export function firstUnwritable(
  value: Json,
  numbers: NumberStyle,
  path: JsonPath = [],
): { path: JsonPath; detail: string } | undefined {
  if (typeof value === 'number') {
    try {
      numbers.format(value)
    } catch (error) {
      if (error instanceof JsonWriteError) return { path, detail: error.message }
      throw error
    }
    return undefined
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return undefined
  if (Array.isArray(value)) {
    for (const [i, item] of value.entries()) {
      const found = firstUnwritable(item, numbers, [...path, i])
      if (found) return found
    }
    return undefined
  }
  if (isObject(value)) {
    for (const key of keysOf(value)) {
      const found = firstUnwritable(value[key], numbers, [...path, key])
      if (found) return found
    }
    return undefined
  }
  return { path, detail: `${typeof value} is not a JSON value` }
}

/**
 * Checks that `text` reads as `after` (numbers as the file writes them). This is the guard against a bug in the diff:
 * `patchJson` runs it on every result, and a result that fails it is never returned.
 */
export function verifyPatched(
  text: string,
  after: unknown,
  numbers: NumberStyle = BLOCKOUT_NUMBERS,
): PatchResult {
  let parsed: Json
  try {
    parsed = JSON.parse(text) as Json
  } catch (error) {
    return refuse([], 'verify-failed', `the patched text is not JSON: ${(error as Error).message}`)
  }
  const path = firstDifference(parsed, after as Json, numbers)
  return path
    ? refuse(
        path,
        'verify-failed',
        `the patched text does not read as the new model at ${JSON.stringify(path)}`,
      )
    : { ok: true, text }
}
