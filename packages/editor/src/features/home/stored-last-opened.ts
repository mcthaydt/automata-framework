import type { LastOpened } from './home-controller'

// The last open project in the browser's `localStorage`: a per-visitor convenience, never state the project
// depends on, so every access is guarded and a failure means "no last project".

const KEY = 'automata-editor-2d:last-opened'

type Keeper = Pick<Storage, 'getItem' | 'setItem'>

/** `storage` is asked each time because the browser may refuse it at the moment of use. */
export function storedLastOpened(storage: () => Keeper | undefined): LastOpened {
  return {
    read() {
      try {
        return storage()?.getItem(KEY) ?? undefined
      } catch {
        return undefined
      }
    },
    write(path) {
      try {
        storage()?.setItem(KEY, path)
      } catch {
        // Nothing to keep it in: the next visit selects the newest project.
      }
    },
  }
}
