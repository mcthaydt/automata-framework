import { loadEditorList } from '@automata/editor/editor-list'

// Which page `automata editor` serves: the game's own editor list decides, so there is no flag to remember. A game
// whose list names a 3D editor gets the full page (the suite with Levels 3D and Characters); every other game gets the
// 2D page (Levels and the Tuner). A game with no list, or one that does not load, gets the 2D page, which is the one
// that shows a list's problems in words.

export type EditorPage = 'suite-2d' | 'suite-full'

/** The editors that only the full page has. */
const THREE_D = new Set(['levels-3d', 'studio'])

export function pageFor(editorList: string | undefined): EditorPage {
  const load = loadEditorList(editorList)
  return load.ok && load.list.file.some((row) => THREE_D.has(row.editor)) ? 'suite-full' : 'suite-2d'
}
