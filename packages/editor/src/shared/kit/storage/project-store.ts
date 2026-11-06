// The storage contract of the editor kit: what an editor can ask of wherever a project lives.
// Five adapters implement it (memory, OPFS, a user folder, download, and a served checkout over HTTP); the editors never see which one.

export interface StoredEntry {
  readonly path: string
  /** Bytes. */
  readonly size: number
  /** The store's own modification time in epoch milliseconds; the value a later write passes back as `expected`. */
  readonly mtime: number
}

/** What a guarded write expects to find: the file at the `mtime` it was read with, or no file at all. */
export type WriteExpectation = { readonly mtime: number } | 'absent'

export type WriteFailure = 'conflict' | StorageFailure

export type WriteResult =
  | { readonly ok: true; readonly mtime: number }
  | { readonly ok: false; readonly reason: WriteFailure; readonly message: string }

/**
 * Why a read, a listing or a removal failed. A write reports the same reasons (and `conflict`) in its result.
 * `policy` is a store that keeps rules of its own (the editor suite's workspace: a path outside its editor list, a
 * read-only or generated file, a removal of a file the change set did not create); asking again will not help.
 * None of the kit's own adapters gives it.
 */
export type StorageFailure = 'denied' | 'quota' | 'io' | 'policy'

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
  readonly kind: 'memory' | 'opfs' | 'folder' | 'download' | 'http'
  /** Files whose whole path starts with `prefix` (plain string prefix), sorted by path in code-unit order. */
  list(prefix?: string): Promise<StoredEntry[]>
  /** The file's bytes, or `undefined` when there is no such file. */
  read(path: string): Promise<Uint8Array | undefined>
  /**
   * Replaces the file. With `expected`, the write happens only if the file still has that `mtime` (a missing file
   * never does), otherwise it is a `conflict` and nothing changes, so a hand edit is never overwritten silently.
   * With `'absent'` it happens only if there is no such file yet (a new file never replaces one); otherwise `conflict`.
   * Either check and the write are two steps in the browser stores, so another tab could slip between them (two tabs
   * creating one new file, both seeing it absent, the second replacing the first); one editor tab per project is the
   * supported setup, as for the mtime guard.
   */
  write(path: string, data: Uint8Array | string, expected?: WriteExpectation): Promise<WriteResult>
  /** Deletes the file; a file that is not there is not an error. */
  remove(path: string): Promise<void>
  /** Optional. No adapter implements it yet: the browsers have no change feed for OPFS or a picked folder. */
  watch?(path: string, listener: () => void): () => void
}

/** Why a guarded write cannot go ahead, or `undefined` when it can: `current` is the file's mtime, if it exists. */
export function expectationProblem(
  expected: WriteExpectation | undefined,
  current: number | undefined,
): string | undefined {
  if (expected === undefined) return undefined
  if (expected === 'absent')
    return current === undefined ? undefined : 'A file with that name already exists.'
  if (current === expected.mtime) return undefined
  return current === undefined ? 'The file no longer exists.' : 'The file changed since it was opened.'
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
