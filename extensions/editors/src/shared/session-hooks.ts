// What the suite's top bar and Ask take from a TOML session. The suite's write path writes Undo and Redo back itself
// and then tells the editor, so the hook's `undo` only follows (`TomlSession.follow`); an accepted proposal is one
// undo step written through the session.
import type { SuiteAskTarget, SuiteUndo } from '@automata/editor/kit/ports'
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

export function askOf(session: TomlSession<unknown>, scope: () => readonly string[]): SuiteAskTarget {
  return {
    path: session.path,
    text: () => session.history.state.text ?? '',
    scope,
    locked: () => [],
    accept: (text, summary) => void session.accept(text, summary),
  }
}
