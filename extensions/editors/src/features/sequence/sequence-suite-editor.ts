// Sequence as a suite editor: `sequence` in the editor list. It opens every cutscene the game has, one at a time, and
// keeps them for the app's life.
import { defineSuiteEditor, type SuiteEditor } from '@automata/editor/kit/ports'
import { canvas, panel, status } from './SequenceRegions.svelte'
import { SequenceSession } from './sequence-session.svelte.ts'

export function createSequence(): SuiteEditor<SequenceSession> {
  return defineSuiteEditor<SequenceSession>({
    id: 'sequence',
    label: 'Sequence',
    icon: 'list',
    hue: 'color/ed/sequence',
    open: (files, ports) => SequenceSession.open(files, ports),
    regions: { panel, canvas, status },
    undo: (session) => session.trail.hook(),
    // Ask proposes whole files; a game has many cutscenes, so Sequence offers none.
  })
}
