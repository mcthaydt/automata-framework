// What Home shows (editor suite spec §5 flow 2, §9 `suite-home`, §11): one card per editor the game's list names, in
// the order the list first names it, or the list's problems when it does not load, in which case every editor is read
// only and there are no cards (the files cannot be listed without a list).
import type { WorkspaceFile } from '@mcthaydt/automata-editor-kit/ports'
import type { EditorListLoad, EditorListProblem } from '../core'
import type { Suite } from './create-suite'
import { entryOf, PROVIDERS } from './suite-entries'

export interface EditorCard {
  /** The id the list names. */
  readonly editor: string
  readonly label: string
  /** The rail entry that opens it; `undefined` for an id no entry knows. */
  readonly entry: string | undefined
  readonly installed: boolean
  /** The package that brings the editor, named when it is not installed; `undefined` when unknown. */
  readonly provider: string | undefined
  readonly files: readonly WorkspaceFile[]
}

export type HomeState =
  | { readonly kind: 'problems'; readonly problems: readonly EditorListProblem[] }
  | { readonly kind: 'cards'; readonly cards: readonly EditorCard[] }

// Levels is one rail entry, but Home tells the two level editors apart.
const LABELS: Readonly<Record<string, string>> = { 'levels-2d': 'Levels 2D', 'levels-3d': 'Levels 3D' }

export function homeOf(
  load: EditorListLoad,
  files: ReadonlyMap<string, readonly WorkspaceFile[]>,
  suite: Suite,
): HomeState {
  if (!load.ok) return { kind: 'problems', problems: load.problems }
  const named = [...new Set(load.list.file.map((row) => row.editor))]
  const cards = named.map((editor): EditorCard => {
    const entry = entryOf(editor)
    return {
      editor,
      label: LABELS[editor] ?? entry?.label ?? editor,
      entry: entry?.id,
      installed: suite.editor(editor) !== undefined,
      provider: PROVIDERS[editor],
      files: files.get(editor) ?? [],
    }
  })
  return { kind: 'cards', cards }
}

/** A problem's key path as the list reads it: `file[0].gates`. */
export function keyPathText(path: readonly (string | number)[]): string {
  if (path.length === 0) return 'the whole list'
  return path
    .map((key, index) => (typeof key === 'number' ? `[${key}]` : index === 0 ? key : `.${key}`))
    .join('')
}
