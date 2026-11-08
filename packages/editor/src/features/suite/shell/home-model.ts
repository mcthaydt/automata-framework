// What Home shows: one card per editor the game's list names, in
// the order the list first names it, or the list's problems when it does not load, in which case every editor is read
// only and there are no cards (the files cannot be listed without a list).

import { writtenBySave } from '../../../shared/editor-list/workspace-policy'
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
  /** Every file of the editor; opening a card opens the editor with all of them. */
  readonly files: readonly WorkspaceFile[]
  /** The rows Home lists: the files, or fewer when the editor groups them (`SuiteEditor.homeFiles`). */
  readonly rows: readonly WorkspaceFile[]
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
  'levels-2d': 'Levels',
  'levels-3d': 'Levels 3D',
}

export function homeOf(
  load: EditorListLoad,
  files: ReadonlyMap<string, readonly WorkspaceFile[]>,
  suite: Suite,
): HomeState {
  if (!load.ok) return { kind: 'problems', problems: load.problems }
  // The cards come in the rail's order (the editors the page registered), then the editors this build lacks in the
  // list's order, so Home and the rail never disagree about which comes first.
  const listed = [...new Set(load.list.file.map((row) => row.editor))]
  const rank = (editor: string): number => {
    const place = suite.editors.findIndex((installed) => installed.id === editor)
    return place === -1 ? suite.editors.length : place
  }
  const named = listed
    .map((editor, order) => ({ editor, order }))
    .sort((a, b) => rank(a.editor) - rank(b.editor) || a.order - b.order)
  const cards = named.map(({ editor }): EditorCard => {
    const installed = suite.editor(editor)
    // Only the files a person opens (a level), not the game files and pictures a level's Save writes beside it.
    const opened = (files.get(editor) ?? []).filter((file) => !writtenBySave(load.list, file.path))
    return {
      editor,
      label: installed?.label ?? LABELS[editor] ?? editor,
      entry: installed?.id,
      installed: installed !== undefined,
      files: opened,
      rows: (installed?.homeFiles ?? ((all) => all))(opened),
    }
  })
  return { kind: 'cards', cards }
}

/**
 * A file named in words, as Home shows it: the last part of its path, without its format endings, with dashes and
 * underscores read as spaces and the first letter raised (`content/rooms/room-1.af2d.json` is "Room 1"). The folders
 * and the format words are how the game stores it, not what a person calls it (12.7 Step G).
 */
export function fileTitle(path: string): string {
  const base = path.slice(path.lastIndexOf('/') + 1)
  const words = base.split('.')[0]?.replace(/[-_]+/g, ' ').trim() ?? ''
  return words === '' ? base : words.charAt(0).toUpperCase() + words.slice(1)
}

/** A problem's key path as the list reads it: `file[0].gates`. */
export function keyPathText(path: readonly (string | number)[]): string {
  if (path.length === 0) return 'the whole list'
  return path
    .map((key, index) => (typeof key === 'number' ? `[${key}]` : index === 0 ? key : `.${key}`))
    .join('')
}
