import { createHandleStore, type DirectoryLike } from './handle-store'
import { classifyStorageError, type ProjectStore, StorageError } from './project-store'

// The folder upgrade: on desktop Chromium a person can point the editor at a real folder, so Save
// writes the game's own files. iPad Safari has no directory picker, so none of this is needed there; the OPFS
// workspace is the default and these are an extra.

type FolderPermission = 'granted' | 'prompt' | 'denied'

/** A directory handle from `showDirectoryPicker`: the File System Access calls TypeScript does not know about. */
export type FolderHandle = DirectoryLike & {
  queryPermission?(descriptor: { mode: 'readwrite' }): Promise<FolderPermission>
  requestPermission?(descriptor: { mode: 'readwrite' }): Promise<FolderPermission>
}

export interface FolderStore extends ProjectStore {
  readonly kind: 'folder'
  /** The folder's name, which is also its key in the vault. */
  readonly name: string
  /** Asks the browser to grant access again. It needs a user gesture; `false` means not granted, for any reason. */
  requestAccess(): Promise<boolean>
}

/** Where picked folders are kept between visits: handles can be stored in IndexedDB, not in localStorage. */
export interface HandleVault {
  save(name: string, handle: FolderHandle): Promise<void>
  load(name: string): Promise<FolderHandle | undefined>
  names(): Promise<string[]>
  forget(name: string): Promise<void>
}

export interface FolderEnv {
  showDirectoryPicker?: (options: { mode: 'readwrite' }) => Promise<FolderHandle>
}

const READWRITE = { mode: 'readwrite' } as const

/**
 * A store over a folder the person picked. Permission can lapse between visits or be revoked while the editor is
 * open, so every call asks first; an unanswered or refused permission is `denied`, and the editor shows Re-grant
 * (`requestAccess`) or a switch to the OPFS workspace. Nothing is lost: the edits stay in the history.
 */
export function createFolderStore(handle: FolderHandle): FolderStore {
  const guard = async (): Promise<void> => {
    const state = (await handle.queryPermission?.(READWRITE)) ?? 'granted'
    if (state === 'granted') return
    throw new StorageError(
      'denied',
      state === 'prompt'
        ? 'Access to the folder needs to be granted again.'
        : 'Access to the folder was refused.',
    )
  }
  const store = createHandleStore(handle, { kind: 'folder', guard })
  return {
    ...store,
    kind: 'folder',
    name: handle.name,
    async requestAccess() {
      try {
        await handle.requestPermission?.(READWRITE)
        await guard()
        return true
      } catch {
        return false
      }
    },
  }
}

/**
 * Opens the browser's folder picker and remembers the choice. `undefined` when the person dismisses the picker or
 * the browser has none. A vault that cannot save does not take the folder away: it is only not remembered, so the
 * person picks it again next time.
 */
export async function pickFolder(
  vault: HandleVault,
  env: FolderEnv = browserFolderEnv(),
): Promise<FolderStore | undefined> {
  if (env.showDirectoryPicker === undefined) return undefined
  let handle: FolderHandle
  try {
    handle = await env.showDirectoryPicker(READWRITE)
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError')
      return undefined
    const { reason, message } = classifyStorageError(error)
    throw new StorageError(reason, message)
  }
  await vault.save(handle.name, handle).catch(() => undefined)
  return createFolderStore(handle)
}

/** The store for a folder picked on an earlier visit, or `undefined` for a name the vault does not know. */
export async function restoreFolder(vault: HandleVault, name: string): Promise<FolderStore | undefined> {
  const handle = await vault.load(name)
  return handle === undefined ? undefined : createFolderStore(handle)
}

function browserFolderEnv(): FolderEnv {
  const picker = (globalThis as { showDirectoryPicker?: FolderEnv['showDirectoryPicker'] })
    .showDirectoryPicker
  return picker === undefined ? {} : { showDirectoryPicker: picker.bind(globalThis) }
}

const STORE_NAME = 'folders'

/** A vault in IndexedDB (a database of one object store keyed by folder name). */
export function createIndexedDbVault(options: { database?: string; factory?: IDBFactory } = {}): HandleVault {
  const database = options.database ?? 'automata-editor-kit'

  function open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = (options.factory ?? indexedDB).open(database, 1)
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME)
      }
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  }

  /** Runs one request in its own transaction and resolves with its result once the transaction has committed. */
  async function transact<T>(
    mode: IDBTransactionMode,
    request: (store: IDBObjectStore) => IDBRequest<T>,
  ): Promise<T> {
    try {
      const db = await open()
      try {
        return await new Promise<T>((resolve, reject) => {
          const transaction = db.transaction(STORE_NAME, mode)
          const pending = request(transaction.objectStore(STORE_NAME))
          transaction.oncomplete = () => resolve(pending.result)
          transaction.onerror = () => reject(transaction.error)
          transaction.onabort = () => reject(transaction.error)
        })
      } finally {
        db.close()
      }
    } catch (error) {
      const { reason, message } = classifyStorageError(error)
      throw new StorageError(reason, message)
    }
  }

  return {
    async save(name, handle) {
      await transact('readwrite', (store) => store.put(handle, name))
    },
    async load(name) {
      return (await transact('readonly', (store) => store.get(name))) as FolderHandle | undefined
    },
    async names() {
      const keys = await transact('readonly', (store) => store.getAllKeys())
      return keys.filter((key): key is string => typeof key === 'string').sort()
    },
    async forget(name) {
      await transact('readwrite', (store) => store.delete(name))
    },
  }
}
