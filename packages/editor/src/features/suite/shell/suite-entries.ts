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

/**
 * The drawing for each editor the page knows, by the editor's id. Both level editors draw `levels` (a game shows one
 * under its name, or says 2D and 3D); the two character editors draw `person`. An editor it does not know is drawn as a
 * list, never left blank.
 */
export function iconFor(id: string): IconName {
  if (id === 'tuner') return 'sliders'
  if (id.startsWith('levels')) return 'levels'
  if (id === 'studio' || id.startsWith('characters')) return 'person'
  if (id === 'feel') return 'zap'
  if (id === 'audio') return 'volume'
  if (id === 'writer') return 'message'
  if (id === 'sequence') return 'clapper'
  if (id === 'schematic') return 'workflow'
  return 'list'
}

type Named = Pick<SuiteEditor<unknown>, 'id' | 'label'>

const isLevels = (id: string): boolean => id.startsWith('levels-')

/**
 * The one name an editor goes by in the rail, on Home's cards and in the Editors menu, so they never disagree. A game
 * with one level editor calls it "Levels"; a game with both says "Levels 2D" and "Levels 3D". `listed` is the editor
 * list's ids; when the list did not load the editor keeps its own label.
 */
export function editorLabel(editor: Named, listed: readonly string[] | undefined): string {
  if (listed === undefined || !isLevels(editor.id)) return editor.label
  const levels = listed.filter(isLevels).length
  if (levels <= 1) return 'Levels'
  return editor.id === 'levels-2d' ? 'Levels 2D' : editor.id === 'levels-3d' ? 'Levels 3D' : editor.label
}

/**
 * The rail, from the registered editors that the game lists, in the order the page registers them. `listed` is the
 * editor list's ids, or undefined when the list did not load: then every installed editor shows, read only.
 */
export function suiteEntries(editors: readonly Named[], listed?: readonly string[]): SuiteEntry[] {
  const shown = listed === undefined ? editors : editors.filter((editor) => listed.includes(editor.id))
  // A list that did not load still names two level editors apart when the build has both.
  const basis = listed ?? shown.map((editor) => editor.id)
  return shown.map((editor) => ({
    id: editor.id,
    label: editorLabel(editor, basis),
    icon: iconFor(editor.id),
    editors: [editor.id],
  }))
}
