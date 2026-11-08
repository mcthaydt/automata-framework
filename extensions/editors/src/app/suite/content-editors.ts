// The content editors, in the order the rail lists them. A suite page adds them after the core editors; the rail
// shows each only to a game whose editor list names it.
import type { SuiteEditor } from '@automata/editor/kit/ports'
import { createFeel } from '../../features/feel/feel-suite-editor.ts'

export function contentEditors(): SuiteEditor<unknown>[] {
  return [createFeel()] as SuiteEditor<unknown>[]
}
