// The suite rail's entries: one per editor the page registers (less those for a kind the game is not), in the order the
// page registers them. Cmd 1 to 9 choose them in this order.
import type { IconName } from '../../../shared/kit/icons/paths.ts'
import type { EditorKind, SuiteEditor } from '../../../shared/kit/ports/suite-editor.ts'

export interface SuiteEntry {
  readonly id: string
  readonly label: string
  /** Drawn above the label in the rail. */
  readonly icon: IconName
  /** The kind of game it is for; none means both. */
  readonly kind?: EditorKind
  /** The editor-list ids this entry opens. */
  readonly editors: readonly string[]
}

/** The rail's drawing for each editor it knows, by the editor's id prefix (`levels-2d` and `levels-3d` are both
 * levels); an editor it does not know is drawn as a list, never left blank. */
function iconFor(id: string): IconName {
  if (id === 'tuner') return 'sliders'
  if (id.startsWith('levels')) return 'grid'
  return 'list'
}

type Named = Pick<SuiteEditor<unknown>, 'id' | 'label' | 'kind'>

/**
 * The kinds of game the editor list describes: 2D when it names `levels-2d`, 3D when it names `levels-3d`. A list that
 * names neither, or that did not load (`undefined`), counts as both, so every editor shows.
 */
export function gameKinds(listed: readonly string[] | undefined): ReadonlySet<EditorKind> {
  const kinds = new Set<EditorKind>()
  if (listed?.includes('levels-2d')) kinds.add('2d')
  if (listed?.includes('levels-3d')) kinds.add('3d')
  return kinds.size === 0 ? new Set<EditorKind>(['2d', '3d']) : kinds
}

const shownFor = (editors: readonly Named[], listed: readonly string[] | undefined): Named[] => {
  const kinds = gameKinds(listed)
  return editors.filter((editor) => editor.kind === undefined || kinds.has(editor.kind))
}

/** An editor's name once the entries shown are known: its own label, plus " 2D" or " 3D" when both kinds show. */
function labelIn(editor: Named, shown: readonly Named[]): string {
  const both =
    shown.some((candidate) => candidate.kind === '2d') && shown.some((candidate) => candidate.kind === '3d')
  return both && editor.kind !== undefined
    ? `${editor.label} ${editor.kind === '2d' ? '2D' : '3D'}`
    : editor.label
}

/**
 * The one name an editor goes by in the rail, on Home's cards and in the Editors menu, so they never disagree. A game
 * with one kind calls the level editor "Levels"; a game with both says "Levels 2D" and "Levels 3D". `listed` is the
 * editor list's ids; `editors` are the ones the page registers.
 */
export function editorLabel(
  editor: Named,
  listed: readonly string[] | undefined,
  editors: readonly Named[] = [editor],
): string {
  return labelIn(editor, shownFor(editors, listed))
}

/**
 * The rail: every editor the page registers, in the order it registers them, except an editor for a kind the game is
 * not. The game's kinds come from the editor list's ids (`listed`), which says which files each editor edits, not which
 * editors exist; an editor the list does not name still shows, and opens on its start page.
 */
export function suiteEntries(editors: readonly Named[], listed?: readonly string[]): SuiteEntry[] {
  const shown = shownFor(editors, listed)
  return shown.map((editor) => ({
    id: editor.id,
    label: labelIn(editor, shown),
    icon: iconFor(editor.id),
    ...(editor.kind === undefined ? {} : { kind: editor.kind }),
    editors: [editor.id],
  }))
}
