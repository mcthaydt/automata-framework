// What Home shows: one card per editor the game's list names, in
// the order the list first names it, or the list's problems when it does not load, in which case every editor is read
// only and there are no cards (the files cannot be listed without a list).
import type { WorkspaceFile } from '../../../shared/kit/ports/suite-ports.ts'
import type { EditorListLoad, EditorListProblem } from '../core'
import type { Suite } from './create-suite'

export interface EditorCard {
  /** The id the list names. */
  readonly editor: string
  readonly label: string
  /** The rail entry that opens it: its own id when the build has it, otherwise `undefined`. */
  readonly entry: string | undefined
  readonly installed: boolean
  readonly files: readonly WorkspaceFile[]
}

export type HomeState =
  | { readonly kind: 'problems'; readonly problems: readonly EditorListProblem[] }
  | { readonly kind: 'cards'; readonly cards: readonly EditorCard[] }

// The names of the editors a list may name, for a card whose editor this build does not have (an installed editor
// brings its own label).
const LABELS: Readonly<Record<string, string>> = {
  tuner: 'Tuner',
  studio: 'Studio',
  audio: 'Audio',
  feel: 'Feel',
  writer: 'Writer',
  schematic: 'Schematic',
  sequence: 'Sequence',
  'levels-2d': 'Levels 2D',
  'levels-3d': 'Levels 3D',
}

export function homeOf(
  load: EditorListLoad,
  files: ReadonlyMap<string, readonly WorkspaceFile[]>,
  suite: Suite,
): HomeState {
  if (!load.ok) return { kind: 'problems', problems: load.problems }
  const named = [...new Set(load.list.file.map((row) => row.editor))]
  const cards = named.map((editor): EditorCard => {
    const installed = suite.editor(editor)
    return {
      editor,
      label: installed?.label ?? LABELS[editor] ?? editor,
      entry: installed?.id,
      installed: installed !== undefined,
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
