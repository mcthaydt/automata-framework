import type { ProjectStore } from '@automata/editor/kit'

// The game's files with a listener on the person's own changes: what the editors write or remove is told, what the sync
// keeps beside the game (`.automata/`) is not. The sync works on the store underneath, so its pulls are not edits.

const NOTES = '.automata/'

export function tapWrites(store: ProjectStore, tap: (paths: readonly string[]) => void): ProjectStore {
  const told = (path: string): void => {
    if (!path.startsWith(NOTES)) tap([path])
  }
  return {
    kind: store.kind,
    list: (prefix) => store.list(prefix),
    read: (path) => store.read(path),
    async write(path, data, expected) {
      const written = await store.write(path, data, expected)
      if (written.ok) told(path)
      return written
    },
    async remove(path) {
      await store.remove(path)
      told(path)
    },
  }
}
