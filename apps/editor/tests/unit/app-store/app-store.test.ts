import { describeProjectStore } from '@mcthaydt/automata-editor/kit/storage/testing'
import { describe, expect, it } from 'vitest'
import { createAppStore } from '#src/features/app-store/app-store.ts'
import { fakeAppFs } from './fake-app-fs.ts'

const ROOT = '/data/Games/lantern-run'
const text = (bytes: Uint8Array | undefined): string | undefined =>
  bytes === undefined ? undefined : new TextDecoder().decode(bytes)

// The kit's own contract: a store the editors cannot tell from OPFS or a served folder.
describeProjectStore('app', () => createAppStore(fakeAppFs(), ROOT))

describe('createAppStore', () => {
  it('is the app kind, and keeps every file under its root', async () => {
    const fs = fakeAppFs()
    const store = createAppStore(fs, ROOT)
    expect(store.kind).toBe('app')
    await store.write('content/feel.toml', 'flash = 2')
    expect(text(fs.bytes(`${ROOT}/content/feel.toml`))).toBe('flash = 2')
    expect(await createAppStore(fs, '/data/Games/other').list()).toEqual([])
  })

  it('refuses a write whose mtime is stale, with a conflict, and changes nothing', async () => {
    const fs = fakeAppFs()
    const store = createAppStore(fs, ROOT)
    const first = await store.write('content/feel.toml', 'flash = 1')
    if (!first.ok) throw new Error('the first write should work')
    // Another process (a pull, Claude on a branch) replaces the file.
    await fs.write(`${ROOT}/content/feel.toml`, new TextEncoder().encode('flash = 5'))
    const stale = await store.write('content/feel.toml', 'flash = 2', { mtime: first.mtime })
    expect(stale).toMatchObject({ ok: false, reason: 'conflict' })
    expect(text(fs.bytes(`${ROOT}/content/feel.toml`))).toBe('flash = 5')
  })

  it('reaches the folder before a write resolves, so a restart reads it (progress persists)', async () => {
    const files = new Map<string, { data: Uint8Array; mtime: number }>()
    const before = createAppStore(fakeAppFs(files), ROOT)
    await before.write('content/feel.toml', 'flash = 3')
    // The app is swiped away here: nothing is kept but the folder.
    const after = createAppStore(fakeAppFs(files), ROOT)
    expect(text(await after.read('content/feel.toml'))).toBe('flash = 3')
    expect((await after.list('content/')).map((entry) => entry.path)).toEqual(['content/feel.toml'])
  })

  it('tells a listener of a path about its own writes and removals, once each', async () => {
    const store = createAppStore(fakeAppFs(), ROOT)
    const seen: string[] = []
    const stop = store.watch('content/feel.toml', () => seen.push('feel'))
    store.watch('content/audio.toml', () => seen.push('audio'))
    await store.write('content/feel.toml', 'flash = 1')
    await store.write('content/other.toml', 'x = 1')
    await store.remove('content/feel.toml')
    expect(seen).toEqual(['feel', 'feel'])
    stop()
    await store.write('content/feel.toml', 'flash = 2')
    expect(seen).toEqual(['feel', 'feel'])
  })

  it('tells a listener when files change outside it, as a pull does', () => {
    const store = createAppStore(fakeAppFs(), ROOT)
    const seen: string[] = []
    store.watch('content/feel.toml', () => seen.push('feel'))
    store.watch('content/audio.toml', () => seen.push('audio'))
    store.notifyChanged(['content/feel.toml', 'content/feel.toml'])
    expect(seen).toEqual(['feel'])
  })

  it('refuses a path that could leave the folder', async () => {
    const store = createAppStore(fakeAppFs(), ROOT)
    await expect(store.read('../secret')).rejects.toThrow(RangeError)
    await expect(store.write('a/../../b', 'x')).rejects.toThrow(RangeError)
  })

  it('reports a full or refused folder as a storage failure, not a crash', async () => {
    const fs = fakeAppFs()
    fs.write = async () => {
      throw Object.assign(new Error('no space left on device'), { name: 'QuotaExceededError' })
    }
    const result = await createAppStore(fs, ROOT).write('content/feel.toml', 'x')
    expect(result).toMatchObject({ ok: false, reason: 'quota' })
  })
})
