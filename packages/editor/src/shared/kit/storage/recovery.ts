// Finds an autosave left by a closed tab and says whether restoring it would replace a newer file.
import { contentHash } from './content-hash'
import { type JournalEntry, journalPath, parseJournalEntry } from './journal-entry'
import { type ProjectStore, statPath } from './project-store'

export interface Recovery {
  /** The editor's snapshot of the document when the autosave was written. */
  readonly payload: string
  readonly savedAt: number
  /** True when the file is not the version the autosave was made on: restoring replaces someone's edit. */
  readonly baseChanged: boolean
}

/**
 * The autosave to offer when `path` is opened, if there is one worth offering: it parses, it
 * names this document, and it is not older than the file (an older one was made before a save that has since
 * happened). Left in place when older; the next clean save removes it. Rejects with a `StorageError` when a store
 * cannot be read; the editor opens the document anyway and says so.
 */
export async function findRecovery(
  store: ProjectStore,
  journal: ProjectStore,
  path: string,
): Promise<Recovery | undefined> {
  const bytes = await journal.read(journalPath(path))
  if (bytes === undefined) return undefined
  const entry = parseJournalEntry(bytes)
  if (entry === undefined || entry.path !== path) return undefined
  const file = await statPath(store, path)
  if (file !== undefined && entry.savedAt < file.mtime) return undefined
  return {
    payload: entry.payload,
    savedAt: entry.savedAt,
    baseChanged: await baseChanged(store, path, entry, file?.mtime),
  }
}

/**
 * Whether the file is no longer the version the autosave was made on. After a save the journal has the file's hash,
 * which holds across tabs and whole-second clocks; before one, only the `mtime` the document was opened with.
 */
async function baseChanged(
  store: ProjectStore,
  path: string,
  entry: JournalEntry,
  mtime: number | undefined,
): Promise<boolean> {
  if (mtime === undefined) return entry.baseMtime !== null
  if (entry.baseHash === undefined) return entry.baseMtime !== mtime
  const bytes = await store.read(path)
  return bytes === undefined || (await contentHash(bytes)) !== entry.baseHash
}

/** Throws the autosave away (the person chose Discard). */
export function discardRecovery(journal: ProjectStore, path: string): Promise<void> {
  return journal.remove(journalPath(path))
}
