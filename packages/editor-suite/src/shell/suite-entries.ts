// The suite rail's nine entries (editor suite spec §2, §10): the seven editors beside the level editors, one Levels
// entry for both level editors, and Review, in rail order (Cmd 1 to 9 choose them in this order). `editors` are the ids
// the game's editor list names (§4.2); `provider` is the package that brings an entry's editors, which Home names when
// this build does not have one (§11, EDS-D3).

export interface SuiteEntry {
  readonly id: string
  readonly label: string
  /** The editor-list ids this entry opens; Review edits nothing and has none. */
  readonly editors: readonly string[]
  readonly provider: string
}

const PLUS = 'editor-plus'
const FREE = 'editor-suite'

export const SUITE_ENTRIES: readonly SuiteEntry[] = [
  { id: 'tuner', label: 'Tuner', editors: ['tuner'], provider: FREE },
  { id: 'studio', label: 'Studio', editors: ['studio'], provider: FREE },
  { id: 'audio', label: 'Audio', editors: ['audio'], provider: FREE },
  { id: 'feel', label: 'Feel', editors: ['feel'], provider: PLUS },
  { id: 'writer', label: 'Writer', editors: ['writer'], provider: PLUS },
  { id: 'schematic', label: 'Schematic', editors: ['schematic'], provider: PLUS },
  { id: 'sequence', label: 'Sequence', editors: ['sequence'], provider: PLUS },
  { id: 'levels', label: 'Levels', editors: ['levels-2d', 'levels-3d'], provider: 'editor-2d and editor-3d' },
  { id: 'review', label: 'Review', editors: [], provider: FREE },
]

/** The entry that opens an editor id, if any entry does. */
export function entryOf(editor: string): SuiteEntry | undefined {
  return SUITE_ENTRIES.find((entry) => entry.editors.includes(editor))
}
