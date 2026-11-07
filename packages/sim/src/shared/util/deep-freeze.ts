import { sortedKeys } from './sorted'

/** Freezes a plain value and everything it holds, so a value that was hashed can't change afterwards. */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value)
    for (const k of sortedKeys(value as object)) deepFreeze((value as Record<string, unknown>)[k])
  }
  return value
}
