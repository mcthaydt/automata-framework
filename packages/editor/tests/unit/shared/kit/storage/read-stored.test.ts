import { describe, expect, test } from 'vitest'
import { createMemoryStore } from '#src/shared/kit/storage/memory-store.ts'
import { type ProjectStore, StorageError } from '#src/shared/kit/storage/project-store.ts'
import { readStored } from '#src/shared/kit/storage/read-stored.ts'

// Opening a file is a stat then a read (ED3D.5b review, item 7): the mtime is the one before the bytes, so a write that
// lands after the read can only make the next save a conflict, never be overwritten silently.

describe('readStored', () => {
  test('reads the bytes with the mtime the stat gave', async () => {
    const store = createMemoryStore({ now: () => 4000 })
    await store.write('levels/a.json', '{}')
    expect(await readStored(store, 'levels/a.json')).toEqual({
      status: 'read',
      mtime: 4000,
      bytes: new TextEncoder().encode('{}'),
    })
  })

  test('a file that is not there is missing, and a longer path that starts with it is not taken for it', async () => {
    const store = createMemoryStore()
    await store.write('a.json.bak', 'x')
    expect(await readStored(store, 'a.json')).toEqual({ status: 'missing' })
  })

  test('a file removed between the stat and the read is missing', async () => {
    const inner = createMemoryStore()
    await inner.write('a.json', 'x')
    const store: ProjectStore = { ...inner, read: async () => undefined }
    expect(await readStored(store, 'a.json')).toEqual({ status: 'missing' })
  })

  test('a store that throws is storageFailed with its reason and message', async () => {
    const inner = createMemoryStore()
    const store: ProjectStore = {
      ...inner,
      list: async () => {
        throw new StorageError('denied', 'The folder needs permission again.')
      },
    }
    expect(await readStored(store, 'a.json')).toEqual({
      status: 'storageFailed',
      reason: 'denied',
      message: 'The folder needs permission again.',
    })
  })
})
