import { formatExactNumber, JsonWriteError } from './json/print'
import type { KeyPath } from './key-path'

// Comparing and checking parsed content values (TOML and JSON alike): plain objects, arrays, strings, numbers, bigints
// (a TOML integer past 2^53), booleans, null and the TOML parser's dates. A member set to `undefined` is no member.

export type Table = Record<string, unknown>

export const isTable = (value: unknown): value is Table =>
  value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)

/** The keys of a table that hold a value. */
export const keysOf = (table: Table): string[] => Object.keys(table).filter((key) => table[key] !== undefined)

const sameDate = (a: Date, b: unknown): boolean =>
  b instanceof Date && a.constructor === b.constructor && a.toISOString() === b.toISOString()

/** The first key path, in key order, where `actual` and `expected` differ, or undefined when they are the same value. */
export function firstDifference(actual: unknown, expected: unknown, path: KeyPath = []): KeyPath | undefined {
  if (typeof actual === 'number' && typeof expected === 'number')
    return actual === expected ? undefined : path
  if (actual instanceof Date) return sameDate(actual, expected) ? undefined : path
  if (Array.isArray(actual) && Array.isArray(expected)) {
    if (actual.length !== expected.length) return path
    for (const [index, item] of actual.entries()) {
      const found = firstDifference(item, expected[index], [...path, index])
      if (found) return found
    }
    return undefined
  }
  if (isTable(actual) && isTable(expected)) {
    const keys = keysOf(actual)
    const stray = [...keys, ...keysOf(expected)].find(
      (key) => (actual[key] === undefined) !== (expected[key] === undefined),
    )
    if (stray !== undefined) return [...path, stray]
    for (const key of keys) {
      const found = firstDifference(actual[key], expected[key], [...path, key])
      if (found) return found
    }
    return undefined
  }
  return Object.is(actual, expected) || actual === expected ? undefined : path
}

/** Whether two values are the same: numbers round-trip exactly, so a value the file already has is not rewritten. */
export const sameValue = (current: unknown, next: unknown): boolean =>
  firstDifference(current, next) === undefined

/** The first value in `value` that cannot be written as content, with why. */
export function firstUnwritable(
  value: unknown,
  path: KeyPath = [],
): { path: KeyPath; detail: string } | undefined {
  if (typeof value === 'number') {
    try {
      formatExactNumber(value)
    } catch (error) {
      if (error instanceof JsonWriteError) return { path, detail: error.message }
      throw error
    }
    return undefined
  }
  if (['string', 'boolean', 'bigint'].includes(typeof value) || value === null || value instanceof Date)
    return undefined
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) {
      const found = firstUnwritable(item, [...path, index])
      if (found) return found
    }
    return undefined
  }
  if (isTable(value)) {
    for (const key of keysOf(value)) {
      const found = firstUnwritable(value[key], [...path, key])
      if (found) return found
    }
    return undefined
  }
  return { path, detail: `${typeof value} is not a content value` }
}
