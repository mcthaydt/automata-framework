// The content editors, in the order the rail lists them. A suite page adds them after the core editors; the rail
// shows each only to a game whose editor list names it.
import type { SuiteEditor } from '@automata/editor/kit/ports'
import { createFeel } from '../../features/feel/feel-suite-editor.ts'
import { createSchematic } from '../../features/schematic/schematic-suite-editor.ts'

export function contentEditors(
  options: { readonly gameUrl?: string | undefined } = {},
): SuiteEditor<unknown>[] {
  // Schematic shows the game beside its diagram (Watch) from the game's dev page, which the editor server names.
  return [createFeel(), createSchematic({ gameUrl: options.gameUrl })] as SuiteEditor<unknown>[]
}
