// One Undo over several files. An action can write two files (a choice is a line in the lines file and a choice in the
// dialogue file); the suite's write path takes back one write at a time, in the order they were made, and then tells
// the editor, so the editor must follow the file written last. The trail remembers that order.
import type { SuiteUndo } from '@automata/editor/kit/ports'
import type { TomlSession } from './toml-session.ts'

export class UndoTrail {
  readonly #trail: TomlSession<unknown>[] = []
  readonly #redo: TomlSession<unknown>[] = []
  readonly #listeners = new Set<() => void>()
  #moving = false

  /** Follows a session's writes from now on. */
  add(session: TomlSession<unknown>): void {
    session.history.subscribe(() => {
      if (this.#moving) return
      // A history also tells us about a transaction's live updates; only a new step moves the revision.
      if (this.#seen.get(session) === session.history.revision) return
      this.#seen.set(session, session.history.revision)
      this.#trail.push(session)
      this.#redo.length = 0
      this.#changed()
    })
  }

  readonly #seen = new WeakMap<TomlSession<unknown>, number>()

  #changed(): void {
    for (const listener of [...this.#listeners]) listener()
  }

  async #move(back: boolean): Promise<void> {
    const session = back ? this.#trail.pop() : this.#redo.pop()
    if (session === undefined) return
    ;(back ? this.#redo : this.#trail).push(session)
    this.#moving = true
    const following = session.follow(back)
    this.#moving = false
    this.#seen.set(session, session.history.revision)
    this.#changed()
    await following
  }

  hook(): SuiteUndo {
    return {
      canUndo: () => this.#trail.length > 0,
      canRedo: () => this.#redo.length > 0,
      undoLabel: () => this.#trail.at(-1)?.history.undoLabel,
      redoLabel: () => this.#redo.at(-1)?.history.redoLabel,
      undo: () => void this.#move(true),
      redo: () => void this.#move(false),
      subscribe: (listener) => {
        this.#listeners.add(listener)
        return () => this.#listeners.delete(listener)
      },
    }
  }
}
