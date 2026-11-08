// The suite rail's entries: one per editor the page registers and the game's editor list names, in the order the page
// registers them, then Review when the suite has change sets to review. Cmd 1 to 9 choose them in this order, so the
// rail never offers an editor the build does not have, nor one for files the game does not have (a game with no sounds
// never sees Audio). Each entry opens its one editor; Review edits nothing.
import type { IconName } from '../../../shared/kit/icons/paths.ts'
import type { SuiteEditor } from '../../../shared/kit/ports/suite-editor.ts'

export interface SuiteEntry {
  readonly id: string
  readonly label: string
  /** Drawn above the label in the rail. */
  readonly icon: IconName
  /** The editor-list ids this entry opens; Review edits nothing and has none. */
  readonly editors: readonly string[]
}

const REVIEW: SuiteEntry = { id: 'review', label: 'Review', icon: 'review', editors: [] }

/** The rail's drawing for each editor it knows, by the editor's id prefix (`levels-2d` and `levels-3d` are both
 * levels); an editor it does not know is drawn as a list, never left blank. */
function iconFor(id: string): IconName {
  if (id === 'tuner') return 'sliders'
  if (id.startsWith('levels')) return 'grid'
  return 'list'
}

/**
 * The rail, from the registered editors; `review` adds Review at the end. `listed` is the editors the game's list
 * names; without it (the list did not load) every registered editor is listed, so the person still has a way in.
 */
export function suiteEntries(
  editors: readonly Pick<SuiteEditor<unknown>, 'id' | 'label'>[],
  review: boolean,
  listed?: ReadonlySet<string>,
): SuiteEntry[] {
  const shown = listed === undefined ? editors : editors.filter((editor) => listed.has(editor.id))
  const entries = shown.map((editor) => ({
    id: editor.id,
    label: editor.label,
    icon: iconFor(editor.id),
    editors: [editor.id],
  }))
  return review ? [...entries, REVIEW] : entries
}
