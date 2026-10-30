// What the 3D editor's open and save flows say (plan ED3D.5c, decisions 5 and 6; ED3D spec §11): which outcomes of an
// open a person has to look at in the error panel. Plain functions, so Node tests cover the words and the components
// only show them.
import type { OpenOutcome } from '../editor-app'

/** The outcomes of an open that show the error panel: something is wrong with the file itself. */
export type PanelOutcome = Extract<
  OpenOutcome,
  { readonly status: 'invalid' | 'unrecognised' | 'notText' | 'tooLarge' }
>

export function needsPanel(outcome: OpenOutcome): outcome is PanelOutcome {
  return (
    outcome.status === 'invalid' ||
    outcome.status === 'unrecognised' ||
    outcome.status === 'notText' ||
    outcome.status === 'tooLarge'
  )
}
