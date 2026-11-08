// The content editors, in the order the rail lists them. A suite page adds them after the core editors; the rail
// shows every one; an editor whose files the game lacks opens on a page that offers to start one.
import type { SuiteEditor } from '@automata/editor/kit/ports'
import { createFeel } from '../../features/feel/feel-suite-editor.ts'
import { createSequence } from '../../features/sequence/sequence-suite-editor.ts'
import { createWriter } from '../../features/writer/writer-suite-editor.ts'

export function contentEditors(): SuiteEditor<unknown>[] {
  return [createFeel(), createWriter(), createSequence()] as SuiteEditor<unknown>[]
}
