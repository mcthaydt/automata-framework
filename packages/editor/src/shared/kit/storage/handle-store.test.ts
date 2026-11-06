import { describe, expect, test } from 'vitest'
import { createFakeOpfs, domError } from '../../../testing/kit/fake-fs'
import { describeProjectStore } from '../../../testing/kit/store-contract'
import { createHandleStore, createOpfsStore } from './handle-store'
import { StorageError, statPath } from './project-store'

const decode = (bytes: Uint8Array | undefined): string | undefined =>
  bytes === undefined ? undefined : new TextDecoder().decode(bytes)

describeProjectStore('opfs over a fake', () => createHandleStore(createFakeOpfs(), { kind: 'opfs' }))
describeProjectStore('folder over a fake', () => createHandleStore(createFakeOpfs(), { kind: 'folder' }))
// A clock that never moves: the worst case of WebKit's whole-second `lastModified`.
const frozen = () => 1_700_000_000_000
describeProjectStore('opfs over a fake whose clock does not move', () =>
  createHandleStore(createFakeOpfs({ now: frozen }), { kind: 'opfs' }),
)

describe('handle store', () => {
  test('reports the kind it was made with', () => {
    expect(createHandleStore(createFakeOpfs(), { kind: 'opfs' }).kind).toBe('opfs')
    expect(createHandleStore(createFakeOpfs(), { kind: 'folder' }).kind).toBe('folder')
  })

  test('creates nested directories and finds the file again in them', async () => {
    const root = createFakeOpfs()
    const store = createHandleStore(root, { kind: 'opfs' })
    await store.write('a/b/c.txt', 'deep')
    const a = await root.getDirectoryHandle('a')
    const b = await a.getDirectoryHandle('b')
    expect(await b.getFileHandle('c.txt')).toBeDefined()
    expect(decode(await store.read('a/b/c.txt'))).toBe('deep')
  })

  test('a conflict does not create the directories it was going to write into', async () => {
    const root = createFakeOpfs()
    const store = createHandleStore(root, { kind: 'opfs' })
    expect(await store.write('x/y.txt', 'no', { mtime: 1 })).toMatchObject({ ok: false, reason: 'conflict' })
    await expect(root.getDirectoryHandle('x')).rejects.toMatchObject({ name: 'NotFoundError' })
  })

  test('a file where a directory is wanted is not a file at that path', async () => {
    const store = createHandleStore(createFakeOpfs(), { kind: 'opfs' })
    await store.write('a/b.txt', 'x')
    expect(await store.read('a')).toBeUndefined()
    expect(await store.write('a', 'y')).toMatchObject({ ok: false, reason: 'io' })
    await expect(store.remove('a/b.txt/c')).resolves.toBeUndefined()
  })

  test('lists only what can match the prefix, and not the directories themselves', async () => {
    const store = createHandleStore(createFakeOpfs(), { kind: 'opfs' })
    await store.write('stages/a.toml', '1')
    await store.write('stages/deep/b.toml', '2')
    await store.write('stats.txt', '3')
    expect((await store.list('st')).map((e) => e.path)).toEqual([
      'stages/a.toml',
      'stages/deep/b.toml',
      'stats.txt',
    ])
    expect((await store.list('stages/d')).map((e) => e.path)).toEqual(['stages/deep/b.toml'])
    expect((await store.list('stag')).map((e) => e.path)).toEqual(['stages/a.toml', 'stages/deep/b.toml'])
    expect(await store.list('stages/deep/b.toml/x')).toEqual([])
  })

  test('mtime is the file’s lastModified', async () => {
    let time = 4000
    const store = createHandleStore(createFakeOpfs({ now: () => time++ }), { kind: 'opfs' })
    const written = await store.write('a.txt', 'x')
    expect((await statPath(store, 'a.txt'))?.mtime).toBe(written.ok ? written.mtime : -1)
    expect(written.ok && written.mtime).toBeGreaterThanOrEqual(4000)
  })

  describe('a clock that does not move between writes', () => {
    test('another store on the same files (another tab) writing in the same tick is a conflict', async () => {
      const root = createFakeOpfs({ now: frozen })
      const mine = createHandleStore(root, { kind: 'opfs' })
      const theirs = createHandleStore(root, { kind: 'opfs' })
      const opened = await mine.write('a.txt', 'one')
      if (!opened.ok) throw new Error('write should succeed')
      expect((await theirs.write('a.txt', 'two')).ok).toBe(true)
      // Same size, same lastModified: only the bytes changed.
      expect((await statPath(mine, 'a.txt'))?.mtime).not.toBe(opened.mtime)
      expect(await mine.write('a.txt', 'six', { mtime: opened.mtime })).toMatchObject({
        ok: false,
        reason: 'conflict',
      })
      expect(decode(await mine.read('a.txt'))).toBe('two')
    })

    test('a change after a read, in the same tick, is a conflict for the reader', async () => {
      const root = createFakeOpfs({ now: frozen })
      const theirs = createHandleStore(root, { kind: 'opfs' })
      await theirs.write('a.txt', 'one')
      const mine = createHandleStore(root, { kind: 'opfs' })
      const seen = await statPath(mine, 'a.txt')
      expect(decode(await mine.read('a.txt'))).toBe('one')
      await theirs.write('a.txt', 'two')
      if (seen === undefined) throw new Error('the file should be listed')
      expect(await mine.write('a.txt', 'six', { mtime: seen.mtime })).toMatchObject({
        ok: false,
        reason: 'conflict',
      })
    })

    test('an unchanged file keeps its mtime across listings, reads and other stores', async () => {
      const root = createFakeOpfs({ now: frozen })
      const mine = createHandleStore(root, { kind: 'opfs' })
      await mine.write('a.txt', 'one')
      const second = await mine.write('a.txt', 'two')
      if (!second.ok) throw new Error('write should succeed')
      await mine.read('a.txt')
      expect((await statPath(mine, 'a.txt'))?.mtime).toBe(second.mtime)
      expect((await mine.write('a.txt', 'three', { mtime: second.mtime })).ok).toBe(true)
    })

    test('overwriting a file this store only listed still gives a new mtime', async () => {
      const root = createFakeOpfs({ now: frozen })
      await createHandleStore(root, { kind: 'opfs' }).write('a.txt', 'one')
      const mine = createHandleStore(root, { kind: 'opfs' })
      const listed = await statPath(mine, 'a.txt')
      const written = await mine.write('a.txt', 'two')
      if (listed === undefined || !written.ok) throw new Error('the file should be listed and written')
      expect(written.mtime).not.toBe(listed.mtime)
    })

    test('a file removed and written again is not the file a caller held', async () => {
      const root = createFakeOpfs({ now: frozen })
      const mine = createHandleStore(root, { kind: 'opfs' })
      const first = await mine.write('a.txt', 'one')
      await mine.remove('a.txt')
      const again = await mine.write('a.txt', 'two')
      if (!(first.ok && again.ok)) throw new Error('both writes should succeed')
      expect(again.mtime).not.toBe(first.mtime)
    })
  })

  describe('failures', () => {
    test('a write that runs out of quota says quota, and the old bytes stay', async () => {
      const root = createFakeOpfs()
      const store = createHandleStore(root, { kind: 'opfs' })
      await store.write('a.txt', 'old')
      root.controls.failNext('write', domError('QuotaExceededError', 'Storage is full.'))
      expect(await store.write('a.txt', 'new')).toEqual({
        ok: false,
        reason: 'quota',
        message: 'Storage is full.',
      })
      expect(decode(await store.read('a.txt'))).toBe('old')
      expect(root.controls.aborts).toBe(1)
    })

    test('a quota error that only shows when the file is closed is still quota, and aborts', async () => {
      const root = createFakeOpfs()
      const store = createHandleStore(root, { kind: 'opfs' })
      await store.write('a.txt', 'old')
      root.controls.failNext('close', domError('QuotaExceededError', 'Storage is full.'))
      expect(await store.write('a.txt', 'new')).toMatchObject({ ok: false, reason: 'quota' })
      expect(decode(await store.read('a.txt'))).toBe('old')
      expect(root.controls.aborts).toBe(1)
    })

    test('NotAllowedError is denied; anything else is io with the browser’s message', async () => {
      const root = createFakeOpfs()
      const store = createHandleStore(root, { kind: 'opfs' })
      root.controls.failNext('write', domError('NotAllowedError', 'Permission was revoked.'))
      expect(await store.write('a.txt', 'x')).toEqual({
        ok: false,
        reason: 'denied',
        message: 'Permission was revoked.',
      })
      root.controls.failNext('write', new Error('disk on fire'))
      expect(await store.write('a.txt', 'x')).toEqual({ ok: false, reason: 'io', message: 'disk on fire' })
    })

    test('after a failure the next write works', async () => {
      const root = createFakeOpfs()
      const store = createHandleStore(root, { kind: 'opfs' })
      root.controls.failNext('write', new Error('once'))
      await store.write('a.txt', 'x')
      expect((await store.write('a.txt', 'y')).ok).toBe(true)
      expect(decode(await store.read('a.txt'))).toBe('y')
    })

    test('a read that fails rejects with a StorageError carrying the reason', async () => {
      const root = createFakeOpfs()
      const store = createHandleStore(root, { kind: 'opfs' })
      await store.write('a.txt', 'x')
      root.controls.failNext('getFile', domError('NotAllowedError', 'No.'))
      const error = await store.read('a.txt').catch((caught: unknown) => caught)
      expect(error).toBeInstanceOf(StorageError)
      expect(error).toMatchObject({ reason: 'denied', message: 'No.' })
    })

    test('a listing that fails rejects with a StorageError', async () => {
      const root = createFakeOpfs()
      const store = createHandleStore(root, { kind: 'opfs' })
      root.controls.failNext('entries', new Error('listing broke'))
      await expect(store.list()).rejects.toMatchObject({
        name: 'StorageError',
        reason: 'io',
        message: 'listing broke',
      })
    })

    test('a conflict check that cannot read the file is a failure, not a conflict', async () => {
      const root = createFakeOpfs()
      const store = createHandleStore(root, { kind: 'opfs' })
      const first = await store.write('a.txt', 'x')
      root.controls.failNext('getFile', domError('NotAllowedError', 'No.'))
      expect(await store.write('a.txt', 'y', { mtime: first.ok ? first.mtime : 0 })).toMatchObject({
        ok: false,
        reason: 'denied',
      })
    })
  })

  describe('guard', () => {
    test('runs before every call', async () => {
      const calls: string[] = []
      const store = createHandleStore(createFakeOpfs(), {
        kind: 'folder',
        guard: async () => {
          calls.push('guard')
        },
      })
      await store.list()
      await store.read('a')
      await store.write('a', 'x')
      await store.remove('a')
      expect(calls).toHaveLength(4)
    })

    test('a refusal is denied everywhere and nothing is touched', async () => {
      const root = createFakeOpfs()
      const store = createHandleStore(root, {
        kind: 'folder',
        guard: async () => {
          throw new StorageError('denied', 'Access to the folder was revoked.')
        },
      })
      expect(await store.write('a.txt', 'x')).toEqual({
        ok: false,
        reason: 'denied',
        message: 'Access to the folder was revoked.',
      })
      await expect(store.read('a.txt')).rejects.toMatchObject({ reason: 'denied' })
      await expect(store.list()).rejects.toMatchObject({ reason: 'denied' })
      await expect(store.remove('a.txt')).rejects.toMatchObject({ reason: 'denied' })
      await expect(root.getFileHandle('a.txt')).rejects.toMatchObject({ name: 'NotFoundError' })
    })

    test('a guard that throws something else is still denied', async () => {
      const store = createHandleStore(createFakeOpfs(), {
        kind: 'folder',
        guard: async () => {
          throw new Error('odd')
        },
      })
      expect(await store.write('a.txt', 'x')).toMatchObject({ ok: false, reason: 'denied', message: 'odd' })
    })
  })
})

describe('createOpfsStore', () => {
  test('opens the root it is given', async () => {
    const root = createFakeOpfs()
    const store = await createOpfsStore({ getRoot: async () => root })
    await store.write('a.txt', 'x')
    expect(await root.getFileHandle('a.txt')).toBeDefined()
    expect(store.kind).toBe('opfs')
  })

  test('works inside a named directory, which it creates, and keeps stores apart', async () => {
    const root = createFakeOpfs()
    const workspace = await createOpfsStore({ directory: 'workspace', getRoot: async () => root })
    const journal = await createOpfsStore({ directory: 'journal', getRoot: async () => root })
    await workspace.write('a.txt', 'x')
    expect(await journal.list()).toEqual([])
    expect((await workspace.list()).map((e) => e.path)).toEqual(['a.txt'])
    const dir = await root.getDirectoryHandle('workspace')
    expect(await dir.getFileHandle('a.txt')).toBeDefined()
  })

  test('rejects when the root cannot be opened', async () => {
    await expect(
      createOpfsStore({
        getRoot: async () => {
          throw domError('SecurityError', 'No storage in a private window.')
        },
      }),
    ).rejects.toMatchObject({ name: 'SecurityError' })
  })
})
