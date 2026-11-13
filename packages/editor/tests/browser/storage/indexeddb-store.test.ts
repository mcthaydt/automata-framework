import { afterAll, describe, expect, test } from 'vitest'
import { createIndexedDbStore } from '#src/shared/kit/storage/indexeddb-store.ts'
import { describeProjectStore } from '#src/testing/kit/store-contract.ts'

// The files kept in IndexedDB, against the browser's real one. It is where a page keeps work when the browser refuses
// the origin private file system (a private window), so it runs in every engine, with databases of its own that are
// deleted afterwards.

const run = `idb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
const databases: string[] = []
function freshDatabase(): string {
  const name = `${run}-${databases.length}`
  databases.push(name)
  return name
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

describeProjectStore('IndexedDB in a real browser', () => createIndexedDbStore({ database: freshDatabase() }))

describe('files kept in IndexedDB', () => {
  const decode = (bytes: Uint8Array | undefined) =>
    bytes === undefined ? undefined : new TextDecoder().decode(bytes)

  test('a second store on the same database, opened after a write, reads it: what a reload does', async () => {
    const database = freshDatabase()
    const first = createIndexedDbStore({ database })
    expect((await first.write('content/levels/a.json', 'kept')).ok).toBe(true)
    const again = createIndexedDbStore({ database })
    expect(decode(await again.read('content/levels/a.json'))).toBe('kept')
    expect((await again.list('content/')).map((entry) => entry.path)).toEqual(['content/levels/a.json'])
  })

  test('folders in one database keep their files apart', async () => {
    const database = freshDatabase()
    const sample = createIndexedDbStore({ database, folder: 'sample-game' })
    const other = createIndexedDbStore({ database, folder: 'workspace' })
    await sample.write('a.txt', 'sample')
    expect(await other.list()).toEqual([])
    expect(decode(await sample.read('a.txt'))).toBe('sample')
  })

  test('a store on a database the browser will not open says so, instead of keeping nothing quietly', async () => {
    const refusing = {
      open() {
        throw new DOMException('This browser keeps nothing.', 'SecurityError')
      },
    } as unknown as IDBFactory
    const store = createIndexedDbStore({ database: freshDatabase(), factory: refusing })
    expect(await store.write('a.txt', 'x')).toMatchObject({ ok: false, reason: 'denied' })
    await expect(store.read('a.txt')).rejects.toMatchObject({ reason: 'denied' })
  })
})
