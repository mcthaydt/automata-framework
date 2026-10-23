// The storage contract of the editor kit (kit spec §4.7): what an editor can ask of wherever a project lives.
// Four adapters implement it (memory, OPFS, a user folder, download); the editors never see which one.

export interface StoredEntry {
  readonly path: string
  /** Bytes. */
  readonly size: number
  /** The store's own modification time in epoch milliseconds; the value a later write passes back as `expected`. */
  readonly mtime: number
}

export type WriteFailure = 'conflict' | 'denied' | 'quota' | 'io'

export type WriteResult =
  | { readonly ok: true; readonly mtime: number }
  | { readonly ok: false; readonly reason: WriteFailure; readonly message: string }

/** Why a read, a listing or a removal failed. A write reports the same reasons (and `conflict`) in its result. */
export type StorageFailure = 'denied' | 'quota' | 'io'

/** `list`, `read` and `remove` reject with this; a missing file is `undefined` or a no-op, never an error. */
export class StorageError extends Error {
  readonly reason: StorageFailure

  constructor(reason: StorageFailure, message: string) {
    super(message)
    this.name = 'StorageError'
    this.reason = reason
  }
}

// Duck-typed, not `instanceof Error`: a DOMException from another realm (an iframe, jsdom) is not one of ours.
function errorName(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'name' in error && typeof error.name === 'string'
    ? error.name
    : undefined
}

function errorMessage(error: unknown): string {
  return typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
    ? error.message
    : String(error)
}

/**
 * Sorts what the platform threw into the three reasons the editor can act on: a full disk (`quota`: export instead),
 * a refusal (`denied`: ask again or switch store) and everything else (`io`), keeping the browser's own message.
 */
export function classifyStorageError(error: unknown): { reason: StorageFailure; message: string } {
  const message = errorMessage(error)
  if (error instanceof StorageError) return { reason: error.reason, message }
  const name = errorName(error)
  if (name === 'QuotaExceededError') return { reason: 'quota', message }
  if (name === 'NotAllowedError' || name === 'SecurityError') return { reason: 'denied', message }
  return { reason: 'io', message }
}

export interface ProjectStore {
  readonly kind: 'memory' | 'opfs' | 'folder' | 'download'
  /** Files whose whole path starts with `prefix` (plain string prefix), sorted by path in code-unit order. */
  list(prefix?: string): Promise<StoredEntry[]>
  /** The file's bytes, or `undefined` when there is no such file. */
  read(path: string): Promise<Uint8Array | undefined>
  /**
   * Replaces the file. With `expected`, the write happens only if the file still has that `mtime` (a missing file
   * never does), otherwise it is a `conflict` and nothing changes, so a hand edit is never overwritten silently.
   */
  write(path: string, data: Uint8Array | string, expected?: { readonly mtime: number }): Promise<WriteResult>
  /** Deletes the file; a file that is not there is not an error. */
  remove(path: string): Promise<void>
  /** Optional. No adapter implements it yet: the browsers have no change feed for OPFS or a picked folder. */
  watch?(path: string, listener: () => void): () => void
}

/** The entry for exactly `path`, or `undefined`. `list(path)` alone would also return `path.bak`. */
export async function statPath(store: ProjectStore, path: string): Promise<StoredEntry | undefined> {
  return (await store.list(path)).find((entry) => entry.path === path)
}

const encoder = new TextEncoder()

/** A copy of what a caller wrote, as bytes, so later changes to the caller's array never reach the store. */
export function toBytes(data: Uint8Array | string): Uint8Array<ArrayBuffer> {
  return typeof data === 'string' ? encoder.encode(data) : data.slice()
}
