// Opening a stored file (kit spec §4.7): the stat goes first and the read second, so the mtime a later save is guarded
// by is the one from before the bytes. A write that lands between the two can then only make that save a conflict;
// it is never overwritten silently. Both editors open files through this (moved here from editor-3d, ED3D.5c).
import { classifyStorageError, type ProjectStore, type StorageFailure, statPath } from './project-store'

export type Stored =
  | { readonly status: 'read'; readonly mtime: number; readonly bytes: Uint8Array }
  | { readonly status: 'missing' }
  | { readonly status: 'storageFailed'; readonly reason: StorageFailure; readonly message: string }

/** A file's bytes with the mtime read before them; never throws. */
export async function readStored(store: ProjectStore, path: string): Promise<Stored> {
  try {
    const entry = await statPath(store, path)
    if (entry === undefined) return { status: 'missing' }
    const bytes = await store.read(path)
    // Removed between the stat and the read: the same as never there.
    if (bytes === undefined) return { status: 'missing' }
    return { status: 'read', mtime: entry.mtime, bytes }
  } catch (error) {
    return { status: 'storageFailed', ...classifyStorageError(error) }
  }
}
