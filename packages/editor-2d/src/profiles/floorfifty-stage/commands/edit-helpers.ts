import type { IdSource } from '../../../model/ids'
import type { StageTheme, StageValue } from '../stage.schema'
import type { StageDocument } from '../stage-document'

// What the stage commands share (EDFF.1d). Commands are pure: they copy what they change and return the same object
// when nothing changes, so a caller can tell "no edit" from "an edit" by identity and `History` records nothing for a
// no-op. A list index or an id the document does not have is a programmer error and throws `RangeError`.

/** A new id from the source. A source that repeats itself is a bug, not something to retry around. */
export function freshId(source: IdSource, taken: readonly string[]): string {
  const id = source.next()
  if (taken.includes(id)) throw new RangeError(`the id source gave "${id}" twice`)
  return id
}

export function checkIndex(what: string, index: number, length: number): void {
  if (!Number.isInteger(index) || index < 0 || index >= length)
    throw new RangeError(`there is no ${what} ${index}; the list has ${length}`)
}

export function insertAt<T>(items: readonly T[], index: number, item: T): T[] {
  return [...items.slice(0, index), item, ...items.slice(index)]
}

export function removeAt<T>(items: readonly T[], index: number): T[] {
  return items.filter((_, position) => position !== index)
}

/** The list with the item at `from` moved so that it stands at `to`. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const moved = [...items]
  const [item] = moved.splice(from, 1)
  moved.splice(to, 0, item as T)
  return moved
}

/**
 * `item` with `key` set to `value`, or without the key when `value` is `undefined`: an optional key is absent, never
 * present and unset, which is how the codec reads a file that has no such line. The same object when it already says so.
 */
export function withKey<T extends object, K extends keyof T>(item: T, key: K, value: T[K]): T {
  if (Object.is(item[key], value)) return item
  const next = { ...item }
  if (value === undefined) Reflect.deleteProperty(next, key)
  else next[key] = value
  return next
}

/** The document with this value; the same document when it is the value it has. */
export function withValue(document: StageDocument, value: StageValue): StageDocument {
  return value === document.value ? document : { ...document, value }
}

export function withTheme(document: StageDocument, theme: StageTheme): StageDocument {
  return theme === document.value.theme ? document : withValue(document, { ...document.value, theme })
}
