import { isTable, keysOf } from './values'

// A value's place in a content document: object keys and array indices from the root (editor suite spec §4.4). It is
// the same shape as the JSON scanner's `JsonPath`, and a TOML array of tables is indexed like any array.
export type KeyPath = readonly (string | number)[]

export const keyPathText = (keyPath: KeyPath): string => JSON.stringify(keyPath)

/** A deep copy of a parsed value; a date is kept as it is (the TOML parser's date classes must survive). */
export function cloneValue<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneValue) as T
  if (isTable(value)) {
    const table: Record<string, unknown> = {}
    for (const key of keysOf(value)) table[key] = cloneValue(value[key])
    return table as T
  }
  return value
}

/** The value at a key path, or `found: false` when the value has nothing there. */
export function valueAt(value: unknown, keyPath: KeyPath): { found: boolean; value: unknown } {
  let at = value
  for (const key of keyPath) {
    if (
      typeof key === 'number'
        ? !Array.isArray(at) || key < 0 || key >= at.length
        : !isTable(at) || at[key] === undefined
    )
      return { found: false, value: undefined }
    at = (at as Record<string | number, unknown>)[key]
  }
  return { found: true, value: at }
}
