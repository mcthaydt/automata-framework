import type { ProjectStore, StorageFailure } from '@mcthaydt/automata-editor-kit/core'

// Writing an export into a game folder (plan ED2D.7b decision 4; 2D editor spec G-m). The Export view remembers each
// file's version when it lists the files; a guarded write first checks every one of them again, so a file that changed
// in the meantime stops the whole write before anything is written, and the conflict dialog decides. The store has no
// transaction: a failure part-way leaves the files written before it.

/** A file's version as last seen: its mtime, or that there was no such file. */
export type Seen = number | 'absent'

export type FolderWrite =
  | { readonly written: number }
  | { readonly conflict: string }
  | { readonly failed: string; readonly reason: StorageFailure; readonly message: string }

async function versionOf(store: ProjectStore, path: string): Promise<Seen> {
  const entry = (await store.list(path)).find((candidate) => candidate.path === path)
  return entry?.mtime ?? 'absent'
}

export async function seenFiles(
  store: ProjectStore,
  paths: readonly string[],
): Promise<ReadonlyMap<string, Seen>> {
  const seen = new Map<string, Seen>()
  for (const path of paths) seen.set(path, await versionOf(store, path))
  return seen
}

export async function writeToFolder(
  store: ProjectStore,
  files: readonly { readonly path: string; readonly contents: string }[],
  seen: ReadonlyMap<string, Seen>,
  mode: 'guarded' | 'overwrite',
): Promise<FolderWrite> {
  if (mode === 'guarded') {
    for (const file of files) {
      if ((await versionOf(store, file.path)) !== (seen.get(file.path) ?? 'absent'))
        return { conflict: file.path }
    }
  }
  for (const file of files) {
    const before = seen.get(file.path) ?? 'absent'
    const expected = mode === 'overwrite' ? undefined : before === 'absent' ? 'absent' : { mtime: before }
    const result = await store.write(file.path, file.contents, expected)
    if (result.ok) continue
    // A file that changed between the check and its write (another tab) is still a conflict, not a failure.
    if (result.reason === 'conflict') return { conflict: file.path }
    return { failed: file.path, reason: result.reason, message: result.message }
  }
  return { written: files.length }
}
