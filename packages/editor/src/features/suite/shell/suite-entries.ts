// The suite rail's entries: one per editor the page registers, in the order it registers them. Cmd 1 to 9 choose them
// in this order, so the rail never offers an editor the build does not have. Each entry opens its one editor.
import type { IconName } from '../../../shared/kit/icons/paths.ts'
import type { SuiteEditor } from '../../../shared/kit/ports/suite-editor.ts'

export interface SuiteEntry {
  readonly id: string
  readonly label: string
  /** Drawn above the label in the rail. */
  readonly icon: IconName
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

/** The rail, from the registered editors. */
export function suiteEntries(editors: readonly Pick<SuiteEditor<unknown>, 'id' | 'label'>[]): SuiteEntry[] {
  return editors.map((editor) => ({
    id: editor.id,
    label: editor.label,
    icon: iconFor(editor.id),
    editors: [editor.id],
  }))
}
