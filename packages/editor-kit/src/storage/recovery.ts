import { journalPath, parseJournalEntry } from './journal-entry'
import { type ProjectStore, statPath } from './project-store'

export interface Recovery {
  /** The editor's snapshot of the document when the autosave was written. */
  readonly payload: string
  readonly savedAt: number
  /** True when the file is not the version the autosave was made on: restoring replaces someone's edit. */
  readonly baseChanged: boolean
}

/**
 * The autosave to offer when `path` is opened (kit spec §5 flow 4), if there is one worth offering: it parses, it
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
    baseChanged: entry.baseMtime !== (file?.mtime ?? null),
  }
}

/** Throws the autosave away (the person chose Discard). */
export function discardRecovery(journal: ProjectStore, path: string): Promise<void> {
  return journal.remove(journalPath(path))
}
