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
  /** The view of the editor's session it opens, for an editor that gives more than one entry. */
  readonly view?: string
}

/** The rail's drawing for each editor it knows, by the editor's id prefix (`levels-2d` and `levels-3d` are both
 * levels); an editor it does not know is drawn as a list, never left blank. */
function iconFor(id: string): IconName {
  if (id === 'tuner') return 'sliders'
  if (id === 'studio') return 'person'
  if (id.startsWith('levels')) return 'grid'
  if (id === 'feel') return 'bolt'
  if (id === 'audio') return 'sound'
  if (id === 'writer') return 'speech'
  if (id === 'sequence') return 'clapper'
  if (id === 'schematic') return 'flow'
  return 'list'
}

type Named = Pick<SuiteEditor<unknown>, 'id' | 'label' | 'kind' | 'entries'>

/** What the rail draws for one entry before the labels are settled. */
interface Slot {
  readonly id: string
  readonly label: string
  readonly icon: IconName
  readonly kind: EditorKind | undefined
  readonly editor: string
  readonly view: string | undefined
}

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

/** An editor's entries (one, itself, unless it gives several) for the kinds of game the list describes. */
function slotsOf(editors: readonly Named[], listed: readonly string[] | undefined): Slot[] {
  const kinds = gameKinds(listed)
  const slots = editors.flatMap((editor): Slot[] =>
    editor.entries === undefined
      ? [
          {
            id: editor.id,
            label: editor.label,
            icon: iconFor(editor.id),
            kind: editor.kind,
            editor: editor.id,
            view: undefined,
          },
        ]
      : editor.entries.map((entry) => ({
          id: entry.id,
          label: entry.label,
          icon: entry.icon,
          kind: entry.kind,
          editor: editor.id,
          view: entry.view,
        })),
  )
  return slots.filter((slot) => slot.kind === undefined || kinds.has(slot.kind))
}

/** An entry's name once the entries shown are known: its own label, plus " 2D" or " 3D" when both kinds show. */
function labelIn(
  slot: { label: string; kind?: EditorKind | undefined },
  shown: readonly { kind?: EditorKind | undefined }[],
): string {
  const both = shown.some((other) => other.kind === '2d') && shown.some((other) => other.kind === '3d')
  return both && slot.kind !== undefined ? `${slot.label} ${slot.kind === '2d' ? '2D' : '3D'}` : slot.label
}

/**
 * The one name an editor goes by in the rail, on Home's cards and in the Editors menu, so they never disagree. A game
 * with one kind calls the level editor "Levels"; a game with both says "Levels 2D" and "Levels 3D". `listed` is the
 * editor list's ids; `editors` are the ones the page registers.
 */
export function editorLabel(
  editor: Pick<Named, 'label' | 'kind'>,
  listed: readonly string[] | undefined,
  editors: readonly Named[] = [],
): string {
  return labelIn(editor, slotsOf(editors, listed))
}

/**
 * The rail: every editor the page registers, in the order it registers them, except an editor for a kind the game is
 * not. The game's kinds come from the editor list's ids (`listed`), which says which files each editor edits, not which
 * editors exist; an editor the list does not name still shows, and opens on its start page. An editor with several
 * entries gives one rail entry each, which open its one session at their own view.
 */
export function suiteEntries(editors: readonly Named[], listed?: readonly string[]): SuiteEntry[] {
  const shown = slotsOf(editors, listed)
  return shown.map((slot) => ({
    id: slot.id,
    label: labelIn(slot, shown),
    icon: slot.icon,
    ...(slot.kind === undefined ? {} : { kind: slot.kind }),
    editors: [slot.editor],
    ...(slot.view === undefined ? {} : { view: slot.view }),
  }))
}
