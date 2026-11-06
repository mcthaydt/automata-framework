import { describe, expect, test } from 'vitest'
import type { ProjectStore } from '../../shared/kit/storage/project-store'
import { StorageError, statPath } from '../../shared/kit/storage/project-store'

const text = (bytes: Uint8Array | undefined): string | undefined =>
  bytes === undefined ? undefined : new TextDecoder().decode(bytes)

/**
 * What every ProjectStore promises, run against each adapter with a fresh, empty store per test.
 * The memory store, the handle stores over fakes and the real OPFS in Chromium, WebKit and Firefox all pass the same cases, so a fake
 * cannot drift from the browser unnoticed.
 */
export function describeProjectStore(name: string, make: () => Promise<ProjectStore> | ProjectStore): void {
  describe(`ProjectStore contract: ${name}`, () => {
    test('a new store lists nothing and reads nothing', async () => {
      const store = await make()
      expect(await store.list()).toEqual([])
      expect(await store.read('a.txt')).toBeUndefined()
    })

    test('a written string reads back as UTF-8 bytes', async () => {
      const store = await make()
      const written = await store.write('a.txt', 'héllo ✓')
      expect(written.ok).toBe(true)
      expect(text(await store.read('a.txt'))).toBe('héllo ✓')
    })

    test('written bytes read back unchanged, and the caller may reuse its array', async () => {
      const store = await make()
      const bytes = new Uint8Array([0, 1, 2, 255])
      await store.write('b.bin', bytes)
      bytes.fill(9)
      expect([...((await store.read('b.bin')) ?? [])]).toEqual([0, 1, 2, 255])
    })

    test('the bytes a read returns belong to the caller', async () => {
      const store = await make()
      await store.write('a.bin', new Uint8Array([1, 2, 3]))
      const first = await store.read('a.bin')
      first?.fill(0)
      expect([...((await store.read('a.bin')) ?? [])]).toEqual([1, 2, 3])
    })

    test('writing again replaces the file and never gives an older mtime', async () => {
      const store = await make()
      const first = await store.write('a.txt', 'one')
      const second = await store.write('a.txt', 'two')
      expect(text(await store.read('a.txt'))).toBe('two')
      if (!(first.ok && second.ok)) throw new Error('both writes should succeed')
      expect(second.mtime).toBeGreaterThanOrEqual(first.mtime)
    })

    test('list reports path, size in bytes and the mtime a write returned, sorted by path, files only', async () => {
      const store = await make()
      const written = await store.write('stages/b.toml', 'héllo')
      await store.write('stages/a.toml', 'x')
      await store.write('top.txt', 'y')
      const entries = await store.list()
      expect(entries.map((entry) => entry.path)).toEqual(['stages/a.toml', 'stages/b.toml', 'top.txt'])
      const b = entries.find((entry) => entry.path === 'stages/b.toml')
      expect(b?.size).toBe(new TextEncoder().encode('héllo').byteLength)
      if (!written.ok) throw new Error('write should succeed')
      expect(b?.mtime).toBe(written.mtime)
    })

    test('list filters by plain string prefix of the whole path', async () => {
      const store = await make()
      await store.write('stages/a.toml', '1')
      await store.write('stages/ab.toml', '2')
      await store.write('stages/sub/c.toml', '3')
      await store.write('other/a.toml', '4')
      await store.write('archive/stages/a.toml', '5')
      expect((await store.list('stages/')).map((entry) => entry.path)).toEqual([
        'stages/a.toml',
        'stages/ab.toml',
        'stages/sub/c.toml',
      ])
      expect((await store.list('stages/a')).map((entry) => entry.path)).toEqual([
        'stages/a.toml',
        'stages/ab.toml',
      ])
      expect(await store.list('nothing/')).toEqual([])
    })

    test('statPath finds one exact path, not its neighbours', async () => {
      const store = await make()
      await store.write('a.toml', '1')
      await store.write('a.toml.bak', '2')
      expect((await statPath(store, 'a.toml'))?.path).toBe('a.toml')
      expect(await statPath(store, 'a')).toBeUndefined()
    })

    test('a write that expects the current mtime goes through', async () => {
      const store = await make()
      const first = await store.write('a.txt', 'one')
      if (!first.ok) throw new Error('write should succeed')
      const second = await store.write('a.txt', 'two', { mtime: first.mtime })
      expect(second.ok).toBe(true)
      expect(text(await store.read('a.txt'))).toBe('two')
    })

    test('a write that expects another mtime is a conflict and changes nothing (EK-e)', async () => {
      const store = await make()
      const first = await store.write('a.txt', 'one')
      if (!first.ok) throw new Error('write should succeed')
      const refused = await store.write('a.txt', 'two', { mtime: first.mtime - 1000 })
      expect(refused).toMatchObject({ ok: false, reason: 'conflict' })
      expect(text(await store.read('a.txt'))).toBe('one')
      expect((await statPath(store, 'a.txt'))?.mtime).toBe(first.mtime)
    })

    test('a write after another, however soon, gets a new mtime, so expecting the first is a conflict (EK-e)', async () => {
      // WebKit's OPFS keeps whole seconds and some folders keep two, so the platform clock alone can repeat.
      const store = await make()
      const first = await store.write('a.txt', 'one')
      const second = await store.write('a.txt', 'two')
      if (!(first.ok && second.ok)) throw new Error('both writes should succeed')
      expect(second.mtime).not.toBe(first.mtime)
      expect((await statPath(store, 'a.txt'))?.mtime).toBe(second.mtime)
      const refused = await store.write('a.txt', 'three', { mtime: first.mtime })
      expect(refused).toMatchObject({ ok: false, reason: 'conflict' })
      expect(text(await store.read('a.txt'))).toBe('two')
      expect((await store.write('a.txt', 'three', { mtime: second.mtime })).ok).toBe(true)
    })

    test('expecting an mtime for a file that is gone is a conflict', async () => {
      const store = await make()
      const refused = await store.write('gone.txt', 'x', { mtime: 123 })
      expect(refused).toMatchObject({ ok: false, reason: 'conflict' })
      expect(await store.read('gone.txt')).toBeUndefined()
    })

    test('a write that expects the file to be absent creates it, folders included', async () => {
      const store = await make()
      const created = await store.write('poses/new/wave.toml', 'one', 'absent')
      expect(created.ok).toBe(true)
      expect(text(await store.read('poses/new/wave.toml'))).toBe('one')
    })

    test('a write that expects the file to be absent is a conflict when it exists, and changes nothing', async () => {
      const store = await make()
      const first = await store.write('a.txt', 'one')
      if (!first.ok) throw new Error('write should succeed')
      const refused = await store.write('a.txt', 'two', 'absent')
      expect(refused).toMatchObject({ ok: false, reason: 'conflict' })
      expect(refused.ok === false && refused.message.length > 0).toBe(true)
      expect(text(await store.read('a.txt'))).toBe('one')
      expect((await statPath(store, 'a.txt'))?.mtime).toBe(first.mtime)
    })

    test('a conflict explains itself', async () => {
      const store = await make()
      await store.write('a.txt', 'one')
      const refused = await store.write('a.txt', 'two', { mtime: 1 })
      expect(refused.ok === false && refused.message.length > 0).toBe(true)
    })

    test('remove deletes the file; removing a missing file does nothing', async () => {
      const store = await make()
      await store.write('dir/a.txt', 'one')
      await store.remove('dir/a.txt')
      expect(await store.read('dir/a.txt')).toBeUndefined()
      expect(await store.list()).toEqual([])
      await expect(store.remove('dir/a.txt')).resolves.toBeUndefined()
      await expect(store.remove('never/was.txt')).resolves.toBeUndefined()
    })

    test('a path that could leave the store is refused before anything happens', async () => {
      const store = await make()
      await expect(store.write('../x', 'no')).rejects.toBeInstanceOf(RangeError)
      await expect(store.read('/x')).rejects.toBeInstanceOf(RangeError)
      await expect(store.remove('a//b')).rejects.toBeInstanceOf(RangeError)
      await expect(store.list('../')).rejects.toBeInstanceOf(RangeError)
      expect(await store.list()).toEqual([])
    })

    test('StorageError carries its reason', () => {
      const error = new StorageError('quota', 'full')
      expect(error).toBeInstanceOf(Error)
      expect(error.reason).toBe('quota')
      expect(error.message).toBe('full')
      expect(error.name).toBe('StorageError')
    })
  })
}
