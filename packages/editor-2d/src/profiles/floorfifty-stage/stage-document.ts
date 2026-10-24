import type { StageValue } from './stage.schema'

// The profile's value (EDFF.1a decision 1). The three lists of a stage that the editor adds to, removes from and
// reorders (`course.extension`, `theme.layers`, `theme.setPieces`) have no key a table could be told apart by, so every
// element carries an id the codec follows through an edit: it tells "moved" from "removed, and a new one added", and a
// moved element keeps its comments.

/** One id per element of each list, in the order of the value's lists. */
export interface ListIds {
  readonly extension: readonly string[]
  readonly layers: readonly string[]
  readonly setPieces: readonly string[]
}

export interface StageDocument {
  readonly value: StageValue
  readonly ids: ListIds
}

/** `b0`, `b1`, … for the elements of a list as the loaded text has them (`b` for base). */
const baseIds = (items: readonly unknown[] | undefined): string[] =>
  (items ?? []).map((_, index) => `b${index}`)

/** The document of a value that was just read from a text: every element is the text's own, numbered in order. */
export function documentOfLoadedValue(value: StageValue): StageDocument {
  return {
    value,
    ids: {
      extension: baseIds(value.course?.extension),
      layers: baseIds(value.theme.layers),
      setPieces: baseIds(value.theme.setPieces),
    },
  }
}
