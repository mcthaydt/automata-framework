// A field of a sentence, as every content editor gives it to `FieldRow`: a number with its range and unit, a short text,
// or one of a few choices. `key` is the file's key, never shown; `label` is what the person reads.
import type { ContentEdit } from '@automata/editor/kit/documents'

export type Field =
  | {
      readonly key: string
      readonly label: string
      readonly kind: 'number'
      readonly unit?: string
      readonly min: number
      readonly max: number
      readonly step: number
      readonly value: number
    }
  | { readonly key: string; readonly label: string; readonly kind: 'text'; readonly value: string }
  | {
      readonly key: string
      readonly label: string
      readonly kind: 'choice'
      readonly value: string
      readonly options: readonly { readonly value: string; readonly label: string }[]
    }

/** A value edit when the key is there, an insert when it is not (an optional key the file left out). */
export function setOrInsert(
  keyPath: readonly (string | number)[],
  before: unknown,
  value: unknown,
): ContentEdit {
  return before === undefined
    ? { keyPath: [...keyPath], insert: value }
    : { keyPath: [...keyPath], expected: before, set: value }
}

/**
 * A row added to a list that may not be there yet. A list the file lacks is made with its first row in one edit, so it is
 * one undo step and the document writes it as the file writes its other lists.
 */
export function appendEdits(
  keyPath: readonly (string | number)[],
  exists: boolean,
  row: unknown,
): ContentEdit[] {
  return [exists ? { keyPath: [...keyPath], insert: row } : { keyPath: [...keyPath], insert: [row] }]
}
