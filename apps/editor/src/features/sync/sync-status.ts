import { generatedNote } from './generated-files.ts'

// The line in the header that says where the game's changes are: the words a person reads, in one place.

export type SyncState = 'saved' | 'pulling' | 'offline' | 'signed-out' | 'conflict'

export interface SyncStatus {
  readonly state: SyncState
  readonly line: string
}

export const STATUS_LINES: Readonly<Record<SyncState, string>> = {
  saved: 'Saved and on GitHub',
  pulling: 'Checking GitHub…',
  offline: 'Saved on this device. Not on GitHub yet: no internet.',
  'signed-out': 'Saved on this device. Not on GitHub yet: sign in to GitHub.',
  conflict: 'A file changed here and on GitHub. Choose which to keep.',
}

export const statusOf = (state: SyncState): SyncStatus => ({ state, line: STATUS_LINES[state] })

/** Saved, with the note about files the app rebuilds from a level. */
export const savedWithNotes = (generated: readonly string[]): SyncStatus => ({
  state: 'saved',
  line: generated.map(generatedNote).join(' '),
})

/** A readable status: `get` now, `subscribe` for every change. */
export interface StatusStore {
  get(): SyncStatus
  subscribe(listener: (status: SyncStatus) => void): () => void
}

export function createStatusStore(initial: SyncStatus): StatusStore & { set(status: SyncStatus): void } {
  let current = initial
  const listeners = new Set<(status: SyncStatus) => void>()
  return {
    get: () => current,
    set(status) {
      if (status.state === current.state && status.line === current.line) return
      current = status
      for (const listener of [...listeners]) listener(status)
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/** What an edited file is called in a commit message: `content/feel.toml` is Feel, a level is `Levels (Start)`. */
export function editLabel(path: string): string {
  const level = /(?:^|\/)([^/]+)\.af2d\.json$/.exec(path)
  if (level !== null) {
    const name = level[1] as string
    return `Levels (${name.charAt(0).toUpperCase()}${name.slice(1)})`
  }
  const name = (path.split('/').pop() ?? path).replace(/\.[^.]+$/, '')
  return name.charAt(0).toUpperCase() + name.slice(1)
}

/** "Edited in Automata: Feel, Levels (Start)": each name once, in the order first edited. */
export function commitMessage(paths: readonly string[]): string {
  return `Edited in Automata: ${[...new Set(paths.map(editLabel))].join(', ')}`
}
