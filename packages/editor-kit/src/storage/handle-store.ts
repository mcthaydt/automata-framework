import { createFileVersions } from './file-versions'
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

// What the adapters need of the File System API, written as small interfaces instead of lib.dom types. The real
// `FileSystemDirectoryHandle` (OPFS or a picked folder) fits them, and so do the in-memory fakes in `testing/`.

export interface WritableLike {
  write(data: Uint8Array<ArrayBuffer>): Promise<void>
  /** Commits what was written; until then the file is unchanged. */
  close(): Promise<void>
  abort(): Promise<void>
}

export interface FileLike {
  readonly lastModified: number
  readonly size: number
  arrayBuffer(): Promise<ArrayBuffer>
}

export interface FileHandleLike {
  readonly kind: 'file'
  readonly name: string
  getFile(): Promise<FileLike>
  createWritable(): Promise<WritableLike>
}

export interface DirectoryLike {
  readonly kind: 'directory'
  readonly name: string
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryLike>
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandleLike>
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>
  entries(): AsyncIterable<readonly [string, { readonly kind: 'file' | 'directory' }]>
}

export interface HandleStoreOptions {
  readonly kind: 'opfs' | 'folder'
  /** Runs before every call; a rejection means the store may not be used now (a revoked folder permission). */
  readonly guard?: () => Promise<void>
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    (error.name === 'NotFoundError' || error.name === 'TypeMismatchError')
  )
}

/**
 * A ProjectStore over a directory handle. OPFS and a folder the person picked are the same API, so they share this
 * code and differ only in `kind` and in the `guard` the folder needs. Writes go through `createWritable`, which
 * commits atomically on `close`; a write that fails is aborted and leaves the old bytes. The `expected` check and the
 * write are two steps, so another tab could slip between them; one editor tab per project is the supported setup.
 * `mtime` is the file's `lastModified`, except where that would repeat for different bytes (`file-versions.ts`).
 */
export function createHandleStore(root: DirectoryLike, options: HandleStoreOptions): ProjectStore {
  const { guard } = options
  const versions = createFileVersions()

  /** Runs `body` after the guard, turning whatever it throws into a StorageError. */
  async function run<T>(body: () => Promise<T>): Promise<T> {
    if (guard !== undefined) {
      try {
        await guard()
      } catch (error) {
        throw error instanceof StorageError
          ? error
          : new StorageError('denied', classifyStorageError(error).message)
      }
    }
    try {
      return await body()
    } catch (error) {
      if (error instanceof StorageError) throw error
      const { reason, message } = classifyStorageError(error)
      throw new StorageError(reason, message)
    }
  }

  /** The directory holding `segments`, or `undefined` when one is missing and `create` is false. */
  async function directory(segments: readonly string[], create: boolean): Promise<DirectoryLike | undefined> {
    let current = root
    for (const segment of segments) {
      try {
        current = await current.getDirectoryHandle(segment, { create })
      } catch (error) {
        if (!create && isMissing(error)) return undefined
        throw error
      }
    }
    return current
  }

  async function existingFile(dir: DirectoryLike, name: string): Promise<FileHandleLike | undefined> {
    try {
      return await dir.getFileHandle(name)
    } catch (error) {
      if (isMissing(error)) return undefined
      throw error
    }
  }

  function split(path: string): { segments: string[]; name: string } {
    const segments = path.split('/')
    const name = segments.pop() ?? path
    return { segments, name }
  }

  async function collect(
    dir: DirectoryLike,
    base: string,
    prefix: string,
    into: StoredEntry[],
  ): Promise<void> {
    for await (const [name, { kind }] of dir.entries()) {
      const path = base === '' ? name : `${base}/${name}`
      if (kind === 'directory') {
        // Only look inside a directory that can hold a match: its path is a prefix of the prefix or the other way round.
        if (`${path}/`.startsWith(prefix) || prefix.startsWith(`${path}/`)) {
          await collect(await dir.getDirectoryHandle(name), path, prefix, into)
        }
      } else if (path.startsWith(prefix)) {
        const file = await (await dir.getFileHandle(name)).getFile()
        into.push({ path, size: file.size, mtime: await versions.observe(path, file) })
      }
    }
  }

  return {
    kind: options.kind,

    async list(prefix = '') {
      assertStorePrefix(prefix)
      return run(async () => {
        const entries: StoredEntry[] = []
        await collect(root, '', prefix, entries)
        return entries.sort((a, b) => comparePaths(a.path, b.path))
      })
    },

    async read(path) {
      assertStorePath(path)
      return run(async () => {
        const { segments, name } = split(path)
        const dir = await directory(segments, false)
        const handle = dir === undefined ? undefined : await existingFile(dir, name)
        if (handle === undefined) return undefined
        const file = await handle.getFile()
        const bytes = new Uint8Array(await file.arrayBuffer())
        await versions.observe(path, file, bytes)
        return bytes
      })
    },

    async write(path, data, expected): Promise<WriteResult> {
      assertStorePath(path)
      try {
        return await run(async () => {
          const { segments, name } = split(path)
          // A write that expects an mtime needs the file, so it never makes the folders; the others may create them.
          const dir = await directory(segments, expected === undefined || expected === 'absent')
          const existing = dir === undefined ? undefined : await existingFile(dir, name)
          // What the file is now, for every write (the version tracker observes here too), then the guard.
          const before =
            existing === undefined ? undefined : await versions.observe(path, await existing.getFile())
          const problem = expectationProblem(expected, before)
          if (problem !== undefined)
            return { ok: false, reason: 'conflict', message: problem } satisfies WriteResult
          const target = dir ?? root
          const handle = existing ?? (await target.getFileHandle(name, { create: true }))
          const bytes = toBytes(data)
          const writable = await handle.createWritable()
          try {
            await writable.write(bytes)
            await writable.close()
          } catch (error) {
            await writable.abort().catch(() => undefined)
            throw error
          }
          const { lastModified } = await handle.getFile()
          return {
            ok: true,
            mtime: await versions.wrote(path, lastModified, bytes, before),
          } satisfies WriteResult
        })
      } catch (error) {
        if (error instanceof StorageError) return { ok: false, reason: error.reason, message: error.message }
        throw error
      }
    },

    async remove(path) {
      assertStorePath(path)
      return run(async () => {
        const { segments, name } = split(path)
        const dir = await directory(segments, false)
        if (dir === undefined) return
        try {
          await dir.removeEntry(name)
        } catch (error) {
          if (!isMissing(error)) throw error
        }
        versions.removed(path)
      })
    },
  }
}

/**
 * The origin private file system, in a named directory of its own when `directory` is given (the workspace and the
 * autosave journal live side by side that way). Rejects when the browser has no OPFS or refuses it.
 */
export async function createOpfsStore(
  options: { directory?: string; getRoot?: () => Promise<DirectoryLike> } = {},
): Promise<ProjectStore> {
  const getRoot = options.getRoot ?? (() => navigator.storage.getDirectory())
  let root = await getRoot()
  if (options.directory !== undefined)
    root = await root.getDirectoryHandle(options.directory, { create: true })
  return createHandleStore(root, { kind: 'opfs' })
}
