import type { WriteOutcome } from '../../../shared/editor-list/write-path'
import type { SuiteUndo } from '../../../shared/kit/ports/suite-editor'
import type { SuiteSession } from './suite-session'

// The top bar's Undo and Redo, as Svelte state. They act on the open editor's own history, or on the suite's (an
// import) with none open (EDS-D19): `owner` is that editor's id, or '' for the suite. A step the write path takes is
// replayed on the editor's own model through its undo hook; a step it refuses is said in words by `onrefused`.
// Call it while a component is set up: its effects follow the session, the owner and the hook as they change.

export interface SuiteHistory {
  readonly canUndo: boolean
  readonly canRedo: boolean
  readonly undoLabel: string
  readonly redoLabel: string
  undo(): Promise<void>
  redo(): Promise<void>
}

export interface SuiteHistoryInputs {
  readonly session: () => SuiteSession
  readonly owner: () => string
  readonly hook: () => SuiteUndo | undefined
  readonly onrefused: (outcome: WriteOutcome | undefined) => void
}

export function suiteHistory({ session, owner, hook, onrefused }: SuiteHistoryInputs): SuiteHistory {
  let state = $state({ canUndo: false, canRedo: false, undoLabel: '', redoLabel: '' })

  $effect(() => {
    const path = session().writePath
    const of = owner()
    const read = () => {
      state = {
        canUndo: path.canUndo(of),
        canRedo: path.canRedo(of),
        undoLabel: path.undoLabel(of) ?? '',
        redoLabel: path.redoLabel(of) ?? '',
      }
    }
    read()
    return path.subscribe(read)
  })

  // A routed write records the editor's own label for the step it just applied.
  $effect(() => {
    const undo = hook()
    session().label = () => undo?.undoLabel() ?? 'Edit'
  })

  async function step(direction: 'undo' | 'redo'): Promise<void> {
    if (!(direction === 'undo' ? state.canUndo : state.canRedo)) return
    const outcome = await session()[direction](owner())
    if (outcome !== undefined && 'written' in outcome) hook()?.[direction]()
    else onrefused(outcome)
  }

  return {
    get canUndo() {
      return state.canUndo
    },
    get canRedo() {
      return state.canRedo
    },
    get undoLabel() {
      return state.undoLabel
    },
    get redoLabel() {
      return state.redoLabel
    },
    undo: () => step('undo'),
    redo: () => step('redo'),
  }
}
