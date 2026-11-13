// Files kept in IndexedDB: where a page keeps a visitor's work when the browser refuses the origin private file
// system. A private window does (WebKit rejects `navigator.storage.getDirectory()` there) and still lets a page keep
// files in IndexedDB for the life of the window, so a reload does not lose them.
import {
  classifyStorageError,
  expectationProblem,
  type ProjectStore,
  StorageError,
  type StoredEntry,
  toBytes,
  type WriteResult,
} from './project-store'
import { assertStorePath, assertStorePrefix, comparePaths } from './store-path'

const FILES = 'files'

interface StoredFile {
  readonly data: Uint8Array
  readonly mtime: number
}

export interface IndexedDbStoreOptions {
  /** The database's name; the editors' files share the default. */
  readonly database?: string
  /** A name inside the database, so two stores (the sample game and a journal) never list each other's files. */
  readonly folder?: string
  readonly factory?: IDBFactory | undefined
  readonly now?: () => number
}

/**
 * A store over one object store, keyed `folder/path`. A write is one transaction (the check against `expected` and the
 * put), and its promise settles when the transaction has committed, so a page that has seen `ok` has the file on disk.
 * `mtime` follows the clock but never repeats or goes back for one file, as the memory store's does.
 */
export function createIndexedDbStore(options: IndexedDbStoreOptions = {}): ProjectStore {
  const database = options.database ?? 'automata-editor-files'
  const folder = options.folder ?? 'files'
  const now = options.now ?? (() => Date.now())
  const key = (path: string): string => `${folder}/${path}`

  function open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const factory = options.factory ?? indexedDB
      const request = factory.open(database, 1)
      request.onupgradeneeded = () => {
        request.result.createObjectStore(FILES)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
      request.onblocked = () => reject(new Error('The browser’s file storage is busy.'))
    })
  }

  /** One transaction on the object store; resolves with what `work` returns once the transaction has committed. */
  async function transact<T>(
    mode: IDBTransactionMode,
    work: (files: IDBObjectStore, done: (value: T) => void) => void,
  ): Promise<T> {
    const db = await open()
    try {
      return await new Promise<T>((resolve, reject) => {
        let result: T
        const transaction = db.transaction(FILES, mode)
        transaction.oncomplete = () => resolve(result)
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error ?? new Error('The browser stopped saving.'))
        work(transaction.objectStore(FILES), (value) => {
          result = value
        })
      })
    } finally {
      db.close()
    }
  }

  const asStorageError = (error: unknown): StorageError => {
    const { reason, message } = classifyStorageError(error)
    return new StorageError(reason, message)
  }

  return {
    kind: 'indexeddb',

    async list(prefix = '') {
      assertStorePrefix(prefix)
      try {
        const lower = key(prefix)
        return await transact<StoredEntry[]>('readonly', (files, done) => {
          const entries: StoredEntry[] = []
          const request = files.openCursor(IDBKeyRange.bound(lower, `${lower}￿`))
          request.onsuccess = () => {
            const cursor = request.result
            if (cursor === null) {
              done(entries.sort((a, b) => comparePaths(a.path, b.path)))
              return
            }
            const stored = cursor.value as StoredFile
            entries.push({
              path: String(cursor.key).slice(folder.length + 1),
              size: stored.data.byteLength,
              mtime: stored.mtime,
            })
            cursor.continue()
          }
        })
      } catch (error) {
        throw asStorageError(error)
      }
    },

    async read(path) {
      assertStorePath(path)
      try {
        return await transact<Uint8Array | undefined>('readonly', (files, done) => {
          const request = files.get(key(path))
          request.onsuccess = () => done((request.result as StoredFile | undefined)?.data.slice())
        })
      } catch (error) {
        throw asStorageError(error)
      }
    },

    async write(path, data, expected): Promise<WriteResult> {
      assertStorePath(path)
      const bytes = toBytes(data)
      try {
        return await transact<WriteResult>('readwrite', (files, done) => {
          const request = files.get(key(path))
          request.onsuccess = () => {
            const existing = request.result as StoredFile | undefined
            const problem = expectationProblem(expected, existing?.mtime)
            if (problem !== undefined) {
              done({ ok: false, reason: 'conflict', message: problem })
              return
            }
            const mtime = existing === undefined ? now() : Math.max(now(), existing.mtime + 1)
            files.put({ data: bytes, mtime } satisfies StoredFile, key(path))
            done({ ok: true, mtime })
          }
        })
      } catch (error) {
        const { reason, message } = classifyStorageError(error)
        return { ok: false, reason, message }
      }
    },

    async remove(path) {
      assertStorePath(path)
      try {
        await transact<void>('readwrite', (files, done) => {
          files.delete(key(path))
          done()
        })
      } catch (error) {
        throw asStorageError(error)
      }
    },
  }
}

const PROBE = 'probe.txt'

/**
 * An IndexedDB store the browser really keeps files in, or `undefined`: a browser without IndexedDB, or one that opens
 * it and then refuses a write, counts as having none, so the caller says its work is not kept. Never rejects. Like the
 * OPFS probe, it writes a file, reads it back and removes it.
 */
export async function openIndexedDbStore(
  options: IndexedDbStoreOptions = {},
): Promise<ProjectStore | undefined> {
  if (options.factory === undefined && typeof indexedDB === 'undefined') return undefined
  const store = createIndexedDbStore(options)
  try {
    if (!(await store.write(PROBE, 'probe')).ok) return undefined
    if ((await store.read(PROBE)) === undefined) return undefined
    await store.remove(PROBE)
    return store
  } catch {
    return undefined
  }
}
