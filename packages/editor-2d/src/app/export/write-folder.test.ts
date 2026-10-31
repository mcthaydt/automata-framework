import { createMemoryStore, type ProjectStore } from '@mcthaydt/automata-editor-kit/core'
import { describe, expect, it } from 'vitest'
import { textOf } from '../../testing/memory-workspace'
import { createTestClock } from '../../testing/test-clock'
import { seenFiles, writeToFolder } from './write-folder'

// The folder write (plan ED2D.7b decision 4, G-m): every file is written with the version it had when the Export view
// listed it, and if any changed since then nothing is written.
function folder() {
  const clock = createTestClock()
  const store: ProjectStore = { ...createMemoryStore({ now: clock.now }), kind: 'folder' }
  return { store, clock }
}
const FILES = [
  { path: 'project.toml', contents: 'project = 2\n' },
  { path: 'levels/one.toml', contents: 'one = 2\n' },
]

describe('writeToFolder', () => {
  it('writes every file over the version it was seen as, or as new when it was absent', async () => {
    const { store, clock } = folder()
    await store.write('project.toml', 'project = 1\n')
    clock.advance(10)
    const seen = await seenFiles(
      store,
      FILES.map((file) => file.path),
    )
    expect(seen.get('project.toml')).toEqual(expect.any(Number))
    expect(seen.get('levels/one.toml')).toBe('absent')
    clock.advance(10)
    expect(await writeToFolder(store, FILES, seen, 'guarded')).toEqual({ written: 2 })
    expect(textOf(await store.read('project.toml'))).toBe('project = 2\n')
    expect(textOf(await store.read('levels/one.toml'))).toBe('one = 2\n')
  })

  it('writes nothing when any file changed since it was seen, and names it (G-m)', async () => {
    const { store, clock } = folder()
    await store.write('project.toml', 'project = 1\n')
    const seen = await seenFiles(
      store,
      FILES.map((file) => file.path),
    )
    clock.advance(10)
    // Someone else writes a level the list saw as absent.
    await store.write('levels/one.toml', 'theirs\n')
    expect(await writeToFolder(store, FILES, seen, 'guarded')).toEqual({ conflict: 'levels/one.toml' })
    expect(textOf(await store.read('project.toml'))).toBe('project = 1\n')
    expect(textOf(await store.read('levels/one.toml'))).toBe('theirs\n')
  })

  it('overwrites every file when the person keeps theirs (Keep mine)', async () => {
    const { store, clock } = folder()
    const seen = await seenFiles(
      store,
      FILES.map((file) => file.path),
    )
    clock.advance(10)
    await store.write('levels/one.toml', 'theirs\n')
    expect(await writeToFolder(store, FILES, seen, 'overwrite')).toEqual({ written: 2 })
    expect(textOf(await store.read('levels/one.toml'))).toBe('one = 2\n')
  })

  it('stops at a write that fails and names the file and the reason', async () => {
    const { store } = folder()
    const full: ProjectStore = {
      ...store,
      async write(path, data, expected) {
        if (path === 'levels/one.toml') return { ok: false, reason: 'quota', message: 'The disk is full.' }
        return store.write(path, data, expected)
      },
    }
    const seen = await seenFiles(
      full,
      FILES.map((file) => file.path),
    )
    expect(await writeToFolder(full, FILES, seen, 'guarded')).toEqual({
      failed: 'levels/one.toml',
      reason: 'quota',
      message: 'The disk is full.',
    })
  })
})
