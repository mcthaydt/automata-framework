import { afterAll, describe, expect, test } from 'vitest'
import { createHistory } from '../history/history'
import { describeProjectStore } from '../testing/store-contract'
import { createDocumentSession } from './document-session'
import { createFolderStore, createIndexedDbVault, type FolderHandle } from './folder'
import { createOpfsStore } from './handle-store'
import { openWorkspace } from './workspace'
import { findRecovery } from './recovery'

// What the fakes cannot prove (kit spec §4.7, §8): the storage code against the browser's real private file system
// and IndexedDB. Every test works in directories and databases of its own, removed afterwards, so a run leaves the
// origin as it found it.

const run = `layout-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const decode = (bytes: Uint8Array | undefined): string | undefined =>
  bytes === undefined ? undefined : new TextDecoder().decode(bytes)

const created: string[] = []
const opfsRoot = (): Promise<FileSystemDirectoryHandle> => navigator.storage.getDirectory()

afterAll(async () => {
  const root = await opfsRoot()
  for (const name of created) await root.removeEntry(name, { recursive: true }).catch(() => undefined)
})

let counter = 0
function freshDirectory(): string {
  counter += 1
  const name = `${run}-${counter}`
  created.push(name)
  return name
}

describeProjectStore('OPFS in Chromium', () =>
  createOpfsStore({ directory: freshDirectory(), getRoot: opfsRoot }),
)

describe('the default workspace in a real browser', () => {
  test('opens as a persistent OPFS workspace, with a journal apart from the documents', async () => {
    const workspace = await openWorkspace()
    expect(workspace.persistent).toBe(true)
    expect(workspace.reason).toBeUndefined()
    expect(workspace.store.kind).toBe('opfs')
    expect(workspace.journal.kind).toBe('opfs')
    const written = await workspace.store.write(`${run}.txt`, 'kept')
    expect(written.ok).toBe(true)
    expect(decode(await workspace.store.read(`${run}.txt`))).toBe('kept')
    expect((await workspace.journal.list()).map((entry) => entry.path)).not.toContain(`${run}.txt`)
    await workspace.store.remove(`${run}.txt`)
  })

  test('a document session saves, keeps a journal, takes a conflict and recovers on real files', async () => {
    const workspace = await openWorkspace()
    const path = `${run}-session.json`
    const first = await workspace.store.write(path, '{"n":0}')
    expect(first.ok).toBe(true)
    const mtime = first.ok ? first.mtime : undefined
    const history = createHistory<{ n: number }>({ n: 0 })
    const session = createDocumentSession({
      store: workspace.store,
      journal: workspace.journal,
      path,
      history,
      serializeFile: (state) => JSON.stringify(state),
      snapshot: (state) => JSON.stringify(state),
      mtime,
    })
    try {
      history.apply('set 1', () => ({ n: 1 }))
      expect(session.status).toBe('dirty')
      await session.flush()
      const recovery = await findRecovery(workspace.store, workspace.journal, path)
      expect(recovery?.payload).toBe('{"n":1}')

      expect(await session.save()).toEqual({ status: 'saved', path })
      expect(decode(await workspace.store.read(path))).toBe('{"n":1}')
      expect(session.status).toBe('saved')
      expect(await findRecovery(workspace.store, workspace.journal, path)).toBeUndefined()

      // Another tab writes the file: the next save sees a changed mtime and writes nothing.
      await new Promise((resolve) => setTimeout(resolve, 5))
      await workspace.store.write(path, '{"n":99}')
      history.apply('set 2', () => ({ n: 2 }))
      expect(await session.save()).toEqual({ status: 'conflict' })
      expect(decode(await workspace.store.read(path))).toBe('{"n":99}')
      expect(await session.overwrite()).toEqual({ status: 'saved', path })
      expect(decode(await workspace.store.read(path))).toBe('{"n":2}')
    } finally {
      session.dispose()
      await workspace.store.remove(path)
      await workspace.journal.remove(`${path}.autosave`)
    }
  })
})

describe('the folder vault in real IndexedDB', () => {
  const databases: string[] = []
  const freshVault = () => {
    const database = `${run}-vault-${databases.length}`
    databases.push(database)
    return createIndexedDbVault({ database })
  }
  afterAll(async () => {
    for (const database of databases) {
      await new Promise<void>((resolve) => {
        const request = indexedDB.deleteDatabase(database)
        request.onsuccess = () => resolve()
        request.onerror = () => resolve()
        request.onblocked = () => resolve()
      })
    }
  })

  async function directory(): Promise<FileSystemDirectoryHandle> {
    const name = freshDirectory()
    return (await opfsRoot()).getDirectoryHandle(name, { create: true })
  }

  test('a stored handle comes back, listed by name, and still works as a folder store', async () => {
    const vault = freshVault()
    const handle = await directory()
    expect(await vault.names()).toEqual([])
    await vault.save(handle.name, handle as unknown as FolderHandle)
    expect(await vault.names()).toEqual([handle.name])
    const loaded = await vault.load(handle.name)
    expect(loaded?.name).toBe(handle.name)
    if (loaded === undefined) throw new Error('the vault lost the handle')
    const store = createFolderStore(loaded)
    expect((await store.write('stage.toml', 'ok = true')).ok).toBe(true)
    expect(decode(await store.read('stage.toml'))).toBe('ok = true')
  })

  test('a name the vault does not know loads as nothing, and forget removes a stored one', async () => {
    const vault = freshVault()
    const handle = await directory()
    expect(await vault.load('nothing')).toBeUndefined()
    await vault.save(handle.name, handle as unknown as FolderHandle)
    await vault.forget(handle.name)
    expect(await vault.names()).toEqual([])
    expect(await vault.load(handle.name)).toBeUndefined()
  })

  test('saving a second handle under the same name replaces the first', async () => {
    const vault = freshVault()
    const handle = await directory()
    await vault.save('docs', handle as unknown as FolderHandle)
    await vault.save('docs', handle as unknown as FolderHandle)
    expect(await vault.names()).toEqual(['docs'])
  })
})
