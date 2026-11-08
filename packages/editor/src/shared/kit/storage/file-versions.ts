import { contentHash } from './content-hash'
import type { FileLike } from './handle-store'

// The `mtime` a handle store reports, when the platform clock is too coarse to tell writes apart. WebKit's origin
// private file system keeps `lastModified` in whole seconds (and some folders keep two), so two writes in one second
// leave the same `lastModified`, and an `expected` check on it alone lets the second write vanish under the first
// (EK-e). The store therefore remembers, per path it has written or read, the token it gave, the file's
// `lastModified` and size, and a hash of its bytes. A file that differs from that while its clock has not passed the
// token gets a token of its own.
//
// The bytes are read only when they are the one way to tell: the same `lastModified` and the same size as what the
// store saw. Known gap: a path the store only listed (never wrote or read) has no record, so its `mtime` is plain
// `lastModified`; the editors read a document before they save it, which makes the record.

interface SeenVersion {
  /** The `mtime` the store reported for this version. */
  readonly token: number
  readonly lastModified: number
  readonly size: number
  /** `undefined` once the store removed the file: only the token is kept, so a new file never repeats it. */
  readonly hash: string | undefined
}

export interface FileVersions {
  /**
   * The `mtime` to report for `file` at `path`. Pass `bytes` when they are already read (a `read`): the file is then
   * remembered. A file the store has never seen is its `lastModified`, and its bytes are not read.
   */
  observe(path: string, file: FileLike, bytes?: Uint8Array): Promise<number>
  /** The `mtime` of what this store just wrote; `before` is the token the file had before the write, if it existed. */
  wrote(path: string, lastModified: number, bytes: Uint8Array, before: number | undefined): Promise<number>
  removed(path: string): void
}

export function createFileVersions(): FileVersions {
  const seen = new Map<string, SeenVersion>()

  /** A token after `floor`: the clock's own value when it moved past it, one more than `floor` when it did not. */
  const after = (lastModified: number, floor: number | undefined): number =>
    floor !== undefined && lastModified <= floor ? floor + 1 : lastModified

  const hashOf = async (file: FileLike, bytes: Uint8Array | undefined): Promise<string> =>
    contentHash(bytes ?? new Uint8Array(await file.arrayBuffer()))

  return {
    async observe(path, file, bytes) {
      const previous = seen.get(path)
      if (previous === undefined) {
        if (bytes === undefined) return file.lastModified
        const hash = await contentHash(bytes)
        seen.set(path, { token: file.lastModified, lastModified: file.lastModified, size: file.size, hash })
        return file.lastModified
      }
      const sameClock = previous.lastModified === file.lastModified && previous.size === file.size
      const hash = sameClock && previous.hash !== undefined ? await hashOf(file, bytes) : undefined
      if (hash !== undefined && hash === previous.hash) return previous.token
      const token = after(file.lastModified, previous.token)
      if (token === file.lastModified && bytes === undefined) {
        // The clock moved on: the file reports its own time, as one the store never saw would, until it is read.
        seen.delete(path)
        return token
      }
      // The clock did not pass the token (or the bytes are here anyway): remember this version to keep its token.
      seen.set(path, {
        token,
        lastModified: file.lastModified,
        size: file.size,
        hash: hash ?? (await hashOf(file, bytes)),
      })
      return token
    },

    async wrote(path, lastModified, bytes, before) {
      const floors = [before, seen.get(path)?.token].filter((value) => value !== undefined)
      const token = after(lastModified, floors.length === 0 ? undefined : Math.max(...floors))
      seen.set(path, { token, lastModified, size: bytes.byteLength, hash: await contentHash(bytes) })
      return token
    },

    removed(path) {
      const previous = seen.get(path)
      if (previous !== undefined) seen.set(path, { ...previous, hash: undefined })
    },
  }
}
