// What Home shows: a card for every entry on the rail, in the rail's order, then one for each editor the list names that
// this build lacks; or the list's problems when it does not load, in which case every editor is read only and there
// are no cards (the files cannot be listed without a list).

import { writtenBySave } from '../../../shared/editor-list/workspace-policy'
import type { EditorKind } from '../../../shared/kit/ports/suite-editor.ts'
import type { WorkspaceFile } from '../../../shared/kit/ports/suite-ports.ts'
import type { EditorListLoad, EditorListProblem } from '../core'
import type { Suite } from './create-suite'
import { editorLabel, suiteEntries } from './suite-entries'

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
  studio: 'Characters',
  audio: 'Audio',
  feel: 'Feel',
  writer: 'Writer',
  schematic: 'Schematic',
  sequence: 'Sequence',
  'levels-2d': 'Levels',
  'levels-3d': 'Levels',
}

// An editor this build lacks still names its kind, so its card reads like the rail's entries.
const unbuilt = (id: string): { id: string; label: string; kind?: EditorKind } => {
  const kind = id.endsWith('-2d') ? '2d' : id.endsWith('-3d') ? '3d' : undefined
  return { id, label: LABELS[id] ?? id, ...(kind === undefined ? {} : { kind }) }
}

export function homeOf(
  load: EditorListLoad,
  files: ReadonlyMap<string, readonly WorkspaceFile[]>,
  suite: Suite,
): HomeState {
  if (!load.ok) return { kind: 'problems', problems: load.problems }
  const listed = [...new Set(load.list.file.map((row) => row.editor))]
  // Only the files a person opens (a level), not the game files and pictures a level's Save writes beside it.
  const opened = (editor: string) =>
    (files.get(editor) ?? []).filter((file) => !writtenBySave(load.list, file.path))
  // One card for every entry on the rail, listed or not (an editor the list does not name has no files and opens on its
  // start page), in the rail's order so Home and the rail never disagree; then the listed editors this build lacks, in
  // the list's order. An editor with several entries has a card for each, over the same files: the entry decides the view.
  const entries = suiteEntries(suite.editors, listed)
  const cards = entries.flatMap((entry): EditorCard[] => {
    const editor = entry.editors[0]
    const installed = editor === undefined ? undefined : suite.editor(editor)
    if (editor === undefined || installed === undefined) return []
    const own = opened(editor)
    return [
      {
        editor,
        label: entry.label,
        entry: entry.id,
        installed: true,
        files: own,
        rows: (installed.homeFiles ?? ((all) => all))(own),
      },
    ]
  })
  const lacking = listed.filter((editor) => suite.editor(editor) === undefined)
  cards.push(
    ...lacking.map(
      (editor): EditorCard => ({
        editor,
        label: editorLabel(unbuilt(editor), listed, suite.editors),
        entry: undefined,
        installed: false,
        files: opened(editor),
        rows: opened(editor),
      }),
    ),
  )
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

/**
 * The titles of a card's files, each as `fileTitle` says it, with the folder in words added to those that agree
 * ("Shop (lines)" and "Shop (dialogue)"), so a card never lists two files by one name.
 */
export function fileTitles(paths: readonly string[]): string[] {
  const titles = paths.map(fileTitle)
  return paths.map((path, index) => {
    const title = titles[index] ?? ''
    if (titles.filter((other) => other === title).length === 1) return title
    const parts = path.split('/')
    const folder = parts.length > 1 ? parts[parts.length - 2]?.replace(/[-_]+/g, ' ').trim() : undefined
    return folder === undefined || folder === '' ? title : `${title} (${folder})`
  })
}

/** A problem's key path as the list reads it: `file[0].gates`. */
export function keyPathText(path: readonly (string | number)[]): string {
  if (path.length === 0) return 'the whole list'
  return path
    .map((key, index) => (typeof key === 'number' ? `[${key}]` : index === 0 ? key : `.${key}`))
    .join('')
}
