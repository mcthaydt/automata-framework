// What `automata editor` lets a browser touch in a game checkout: with
// `content/editors.toml` the editor list decides (a file is written only through a row, never the list, `.git` or a
// gate's records; a file that is read only is still readable, so the editor can show it); without one, only level files
// (`*.af2d.json` outside the folders a build or a tool owns) are readable and writable. Paths outside the checkout are never
// reachable.
import { fileAccess, loadEditorList } from '@mcthaydt/automata-editor/editor-list'

export interface EditorPolicy {
  /** Whether `path` (root-relative, `/`-separated) may be listed and read. */
  canRead(path: string): boolean
  /** Whether `path` may be written or removed. */
  canWrite(path: string): boolean
}

/** The one kind of file an editor reaches when the game has no editor list. */
const LEVEL_FILE = '.af2d.json'

/** Folders a person's tools own: nothing in them is an editor's to read or write. */
const OWNED = new Set(['.git', 'node_modules', 'dist', '.vitest', '.claude', '.github'])

const inside = (path: string): boolean =>
  path !== '' &&
  !path.startsWith('/') &&
  !path.includes('\\') &&
  path.split('/').every((segment) => segment !== '' && segment !== '.' && segment !== '..')

const ownedByTools = (path: string): boolean => path.split('/').some((segment) => OWNED.has(segment))

/** The policy of a checkout, from its editor list text when it has one. */
export function editorPolicy(listText: string | undefined): EditorPolicy {
  if (listText === undefined) {
    const levelFile = (path: string): boolean =>
      inside(path) && !ownedByTools(path) && path.endsWith(LEVEL_FILE)
    return { canRead: levelFile, canWrite: levelFile }
  }
  const loaded = loadEditorList(listText)
  // A list that does not load lets nothing be written: the editor shows its problem, and no row widens anything.
  if (!loaded.ok) return { canRead: () => false, canWrite: () => false }
  const { list } = loaded
  return {
    canRead: (path) => {
      if (!inside(path)) return false
      const access = fileAccess(list, path)
      return access.writable || (access.reason !== 'never' && access.reason !== 'outside')
    },
    canWrite: (path) => inside(path) && fileAccess(list, path).writable,
  }
}
