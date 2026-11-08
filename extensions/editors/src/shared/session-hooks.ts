// What the suite's top bar takes from a TOML session. The suite's write path writes Undo and Redo back itself and then
// tells the editor, so the hook's `undo` only follows (`TomlSession.follow`).
import type { SuiteUndo } from '@automata/editor/kit/ports'
import type { TomlSession } from './toml-session.ts'

export function undoOf(session: TomlSession<unknown>): SuiteUndo {
  const { history } = session
  return {
    canUndo: () => history.canUndo,
    canRedo: () => history.canRedo,
    undoLabel: () => history.undoLabel,
    redoLabel: () => history.redoLabel,
    undo: () => void session.follow(true),
    redo: () => void session.follow(false),
    subscribe: (listener) => history.subscribe(() => listener()),
  }
}
