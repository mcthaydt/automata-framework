import {
  assertStorePath,
  assertStorePrefix,
  classifyStorageError,
  comparePaths,
  expectationProblem,
  type ProjectStore,
  StorageError,
  type StoredEntry,
  toBytes,
  type WriteExpectation,
  type WriteResult,
} from '@mcthaydt/automata-editor/kit/storage'
import type { AppFs } from './app-fs.ts'

// A ProjectStore over a game's folder in the app's own storage (a phone's), through `AppFs`. A write reaches the
// device before it resolves, so an edit survives the app being swiped away a moment later: the phone ends a
// backgrounded app without warning. The kit's `flushOnHide` writes the editors' pending autosaves into this store.

/** What the app keeps in the game's folder beside the game: git's files and its own, which an editor never lists. */
const KEPT_APART = ['.git/', '.automata/']

/** The app's store: a `ProjectStore` that also hears of changes made outside it. */
export interface AppStore extends ProjectStore {
  readonly kind: 'app'
  watch(path: string, listener: () => void): () => void
  /** Files below the folder changed by something other than this store (a pull). Each path's listeners hear once. */
  notifyChanged(paths: readonly string[]): void
}

/** The store of the game at `root` (an absolute folder). */
export function createAppStore(fs: AppFs, root: string): AppStore {
  const folder = root.replace(/\/+$/, '')
  const absolute = (path: string): string => `${folder}/${path}`
  const listeners = new Map<string, Set<() => void>>()

  const tell = (path: string): void => {
    for (const listener of [...(listeners.get(path) ?? [])]) listener()
  }

  const fail = (error: unknown): never => {
    const { reason, message } = classifyStorageError(error)
    throw new StorageError(reason, message)
  }

  return {
    kind: 'app',

    async list(prefix = '') {
      assertStorePrefix(prefix)
      let found: Awaited<ReturnType<AppFs['list']>>
      try {
        found = await fs.list(folder)
      } catch (error) {
        return fail(error)
      }
      const entries: StoredEntry[] = []
      for (const entry of found) {
        const path = entry.path.slice(folder.length + 1)
        if (path.startsWith(prefix) && !KEPT_APART.some((apart) => path.startsWith(apart)))
          entries.push({ path, size: entry.size, mtime: entry.mtime })
      }
      return entries.sort((a, b) => comparePaths(a.path, b.path))
    },

    async read(path) {
      assertStorePath(path)
      try {
        return await fs.read(absolute(path))
      } catch (error) {
        return fail(error)
      }
    },

    async write(path, data, expected?: WriteExpectation): Promise<WriteResult> {
      assertStorePath(path)
      try {
        if (expected !== undefined) {
          const current = (await fs.list(folder)).find((entry) => entry.path === absolute(path))
          const problem = expectationProblem(expected, current?.mtime)
          if (problem !== undefined) return { ok: false, reason: 'conflict', message: problem }
        }
        const { mtime } = await fs.write(absolute(path), toBytes(data))
        tell(path)
        return { ok: true, mtime }
      } catch (error) {
        return { ok: false, ...classifyStorageError(error) }
      }
    },

    async remove(path) {
      assertStorePath(path)
      try {
        await fs.remove(absolute(path))
      } catch (error) {
        return fail(error)
      }
      tell(path)
    },

    watch(path, listener) {
      assertStorePath(path)
      const set = listeners.get(path) ?? new Set()
      set.add(listener)
      listeners.set(path, set)
      return () => {
        set.delete(listener)
      }
    },

    notifyChanged(paths) {
      for (const path of new Set(paths)) tell(path)
    },
  }
}
