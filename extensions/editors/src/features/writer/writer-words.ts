// The words Writer uses for a line's kind. A key (`dialogue`, `bark`) is never shown; the person reads what the line is
// for.
import type { LineKind } from '@automata/narrative/sim'

export const KIND_WORDS: Readonly<Record<LineKind, string>> = {
  dialogue: 'Said in a conversation',
  bark: 'Called out',
  caption: 'On screen in a cutscene',
  examine: 'Read when you look at something',
  item: 'Shown with an item',
  note: 'A note to read',
  objective: 'Shown as your goal',
  caught: 'Said when you are caught',
  file: 'Read from a file',
}

/** The kinds a person can choose when adding a line, in the order offered. */
export const ADDABLE_KINDS: readonly LineKind[] = ['dialogue', 'bark', 'caption', 'examine']
