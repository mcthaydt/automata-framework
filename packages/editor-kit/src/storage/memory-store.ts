import { type ProjectStore, type StoredEntry, toBytes, type WriteResult } from './project-store'
import { assertStorePath, assertStorePrefix, comparePaths } from './store-path'

interface MemoryFile {
  data: Uint8Array
  mtime: number
}

/**
 * A store that lives in this object: the tests' store, and what the editor falls back to when OPFS is unavailable.
 * `mtime` follows the injected clock but never repeats or goes back for one file, so two writes in the same
 * millisecond cannot hide a conflict.
 */
export function createMemoryStore(options: { now?: () => number } = {}): ProjectStore {
  const now = options.now ?? (() => Date.now())
  const files = new Map<string, MemoryFile>()

  return {
    kind: 'memory',

    async list(prefix = '') {
      assertStorePrefix(prefix)
      const entries: StoredEntry[] = []
      for (const [path, file] of files) {
        if (path.startsWith(prefix)) entries.push({ path, size: file.data.byteLength, mtime: file.mtime })
      }
      return entries.sort((a, b) => comparePaths(a.path, b.path))
    },

    async read(path) {
      assertStorePath(path)
      return files.get(path)?.data.slice()
    },

    async write(path, data, expected): Promise<WriteResult> {
      assertStorePath(path)
      const existing = files.get(path)
      if (expected !== undefined && existing?.mtime !== expected.mtime) {
        const message =
          existing === undefined ? 'The file no longer exists.' : 'The file changed since it was opened.'
        return { ok: false, reason: 'conflict', message }
      }
      const mtime = existing === undefined ? now() : Math.max(now(), existing.mtime + 1)
      files.set(path, { data: toBytes(data), mtime })
      return { ok: true, mtime }
    },

    async remove(path) {
      assertStorePath(path)
      files.delete(path)
    },
  }
}
