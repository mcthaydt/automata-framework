// What the autosave journal holds (kit spec §4.7): one JSON file per document, next to where its autosave would be
// found again. The payload is the editor's own snapshot string; the kit never looks inside it.

const FORMAT = 'af-autosave/1'

export interface JournalEntry {
  readonly path: string
  /** Epoch milliseconds when the journal was written; compared with the file's modification time on open. */
  readonly savedAt: number
  /** The file's `mtime` when the editor opened or last saved it; `null` for a document with no file yet. */
  readonly baseMtime: number | null
  readonly payload: string
}

/** Where the journal for a document lives, in the journal store. */
export function journalPath(path: string): string {
  return `${path}.autosave`
}

export function encodeJournalEntry(entry: JournalEntry): string {
  return JSON.stringify({ format: FORMAT, ...entry })
}

/** The entry in `bytes`, or `undefined` when it is not one (damaged, empty, or another version). */
export function parseJournalEntry(bytes: Uint8Array): JournalEntry | undefined {
  let value: unknown
  try {
    value = JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return undefined
  }
  if (typeof value !== 'object' || value === null) return undefined
  const { format, path, savedAt, baseMtime, payload } = value as Record<string, unknown>
  if (format !== FORMAT) return undefined
  if (typeof path !== 'string' || typeof payload !== 'string') return undefined
  if (typeof savedAt !== 'number' || !Number.isFinite(savedAt)) return undefined
  if (baseMtime !== null && (typeof baseMtime !== 'number' || !Number.isFinite(baseMtime))) return undefined
  return { path, savedAt, baseMtime, payload }
}
