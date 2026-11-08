import { loadEditorList } from '@automata/editor/editor-list'

// Which page `automata editor` serves: the game's own editor list decides, so there is no flag to remember. A game whose
// list names a 3D editor or a content editor gets the full page (every editor: the core ones, Levels 3D and Characters,
// Feel, Audio, Writer, Sequence and Schematic; the rail shows each one the game's kind can use, whether or not the list
// names it). Every other game gets the 2D page (Levels, Characters and the Tuner). A game with no list, or one that
// does not load, gets the 2D page, which is the one that shows a list's problems in words.

export type EditorPage = 'suite-2d' | 'suite-full'

/** The 3D editors, which only the full page has. */
export const THREE_D_EDITORS: ReadonlySet<string> = new Set(['levels-3d', 'studio'])

/** The content editors, by id, with the name a person sees; only the full page has them. */
export const CONTENT_EDITORS: ReadonlyMap<string, string> = new Map([
  ['feel', 'Feel'],
  ['audio', 'Audio'],
  ['writer', 'Writer'],
  ['sequence', 'Sequence'],
  ['schematic', 'Schematic'],
])

/** The editors the list names that only the full page has, in the list's order, each once. */
export function fullPageEditors(editorList: string | undefined): readonly string[] {
  const load = loadEditorList(editorList)
  if (!load.ok) return []
  const named = load.list.file.map((row) => row.editor)
  return [...new Set(named)].filter((editor) => THREE_D_EDITORS.has(editor) || CONTENT_EDITORS.has(editor))
}

export function pageFor(editorList: string | undefined): EditorPage {
  return fullPageEditors(editorList).length > 0 ? 'suite-full' : 'suite-2d'
}
