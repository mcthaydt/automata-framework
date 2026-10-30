// The suite rail's nine entries (editor suite spec §2, §10): the seven editors beside the level editors, one Levels
// entry for both level editors, and Review, in rail order (Cmd 1 to 9 choose them in this order). `editors` are the ids
// the game's editor list names (§4.2); `provider` is the package that brings an entry's editors, which Home names when
// this build does not have one (§11, EDS-D3).

export interface SuiteEntry {
  readonly id: string
  readonly label: string
  /** The editor-list ids this entry opens; Review edits nothing and has none. */
  readonly editors: readonly string[]
}

export const SUITE_ENTRIES: readonly SuiteEntry[] = [
  { id: 'tuner', label: 'Tuner', editors: ['tuner'] },
  { id: 'studio', label: 'Studio', editors: ['studio'] },
  { id: 'audio', label: 'Audio', editors: ['audio'] },
  { id: 'feel', label: 'Feel', editors: ['feel'] },
  { id: 'writer', label: 'Writer', editors: ['writer'] },
  { id: 'schematic', label: 'Schematic', editors: ['schematic'] },
  { id: 'sequence', label: 'Sequence', editors: ['sequence'] },
  { id: 'levels', label: 'Levels', editors: ['levels-2d', 'levels-3d'] },
  { id: 'review', label: 'Review', editors: [] },
]

/** The package that brings each editor id. */
export const PROVIDERS: Readonly<Record<string, string>> = {
  tuner: 'editor-suite',
  studio: 'editor-suite',
  audio: 'editor-suite',
  feel: 'editor-plus',
  writer: 'editor-plus',
  schematic: 'editor-plus',
  sequence: 'editor-plus',
  'levels-2d': 'editor-2d',
  'levels-3d': 'editor-3d',
}

/** The entry that opens an editor id, if any entry does. */
export function entryOf(editor: string): SuiteEntry | undefined {
  return SUITE_ENTRIES.find((entry) => entry.editors.includes(editor))
}
