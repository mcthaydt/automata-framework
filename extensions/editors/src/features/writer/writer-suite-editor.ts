// Writer as a suite editor: `writer` in the editor list. It opens every scene's lines and conversations the list hands
// it, one scene at a time, and keeps them for the app's life.
import { defineSuiteEditor, type SuiteEditor } from '@automata/editor/kit/ports'
import { canvas, panel, status } from './WriterRegions.svelte'
import { WriterSession } from './writer-session.svelte.ts'

export function createWriter(): SuiteEditor<WriterSession> {
  return defineSuiteEditor<WriterSession>({
    id: 'writer',
    label: 'Writer',
    icon: 'list',
    hue: 'color/ed/writer',
    open: (files, ports) => WriterSession.open(files, ports),
    regions: { panel, canvas, status },
    undo: (session) => session.trail.hook(),
    // Ask proposes whole files; Writer's words are two files at once, so it offers none.
  })
}
