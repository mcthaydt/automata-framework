import type { FileLike } from './handle-store'

// The `mtime` a handle store reports, when the platform clock is too coarse to tell writes apart. WebKit's origin
// private file system keeps `lastModified` in whole seconds (and some folders keep two), so two writes in one second
// leave the same `lastModified`, and an `expected` check on it alone lets the second write vanish under the first
// (EK-e). The store therefore remembers, per path it has written or read, the token it gave and the bytes it saw; a
// file that differs from those bytes while its clock has not passed the token gets a token of its own.

interface SeenVersion {
  /** The `mtime` the store reported for these bytes. */
  readonly token: number
  readonly lastModified: number
  /** `undefined` once the store removed the file: only the token is kept, so a new file never repeats it. */
  readonly bytes: Uint8Array | undefined
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.byteLength !== b.byteLength) return false
  for (let i = 0; i < a.byteLength; i += 1) if (a[i] !== b[i]) return false
  return true
}

export interface FileVersions {
  /**
   * The `mtime` to report for `file` at `path`. Pass `bytes` when they are already read (a `read`): the file is then
   * remembered. A file the store has never seen is its `lastModified`, and its bytes are not read.
   */
  observe(path: string, file: FileLike, bytes?: Uint8Array): Promise<number>
  /** The `mtime` of what this store just wrote; `before` is the token the file had before the write, if it existed. */
  wrote(path: string, lastModified: number, bytes: Uint8Array, before: number | undefined): number
  removed(path: string): void
}

export function createFileVersions(): FileVersions {
  const seen = new Map<string, SeenVersion>()

  /** A token after `floor`: the clock's own value when it moved past it, one more than `floor` when it did not. */
  const after = (lastModified: number, floor: number | undefined): number =>
    floor !== undefined && lastModified <= floor ? floor + 1 : lastModified

  return {
    async observe(path, file, bytes) {
      const previous = seen.get(path)
      if (previous === undefined && bytes === undefined) return file.lastModified
      const current = bytes ?? new Uint8Array(await file.arrayBuffer())
      if (
        previous?.bytes !== undefined &&
        previous.lastModified === file.lastModified &&
        sameBytes(previous.bytes, current)
      ) {
        return previous.token
      }
      const token = after(file.lastModified, previous?.token)
      seen.set(path, { token, lastModified: file.lastModified, bytes: current.slice() })
      return token
    },

    wrote(path, lastModified, bytes, before) {
      const floor = Math.max(before ?? -Infinity, seen.get(path)?.token ?? -Infinity)
      const token = after(lastModified, Number.isFinite(floor) ? floor : undefined)
      seen.set(path, { token, lastModified, bytes: bytes.slice() })
      return token
    },

    removed(path) {
      const previous = seen.get(path)
      if (previous !== undefined) seen.set(path, { ...previous, bytes: undefined })
    },
  }
}
