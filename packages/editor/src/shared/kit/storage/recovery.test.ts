import { describe, expect, test } from 'vitest'
import { createFakeOpfs } from '../../../testing/kit/fake-fs'
import { createTestClock } from '../../../testing/kit/test-clock'
import { createHistory } from '../history/history'
import { createDocumentSession } from './document-session'
import { createHandleStore } from './handle-store'
import { encodeJournalEntry, journalPath } from './journal-entry'
import { createMemoryStore } from './memory-store'
import { discardRecovery, findRecovery } from './recovery'

const PATH = 'stages/a.toml'

async function setup(fileMtimeNow: number) {
  let time = fileMtimeNow
  const store = createMemoryStore({ now: () => time })
  const journal = createMemoryStore()
  const writeFile = async (): Promise<number> => {
    const result = await store.write(PATH, 'file')
    if (!result.ok) throw new Error('write should succeed')
    return result.mtime
  }
  const writeJournal = (
    entry: Partial<{ path: string; savedAt: number; baseMtime: number | null; payload: string }>,
  ) =>
    journal.write(
      journalPath(PATH),
      encodeJournalEntry({ path: PATH, savedAt: 0, baseMtime: null, payload: 'edited', ...entry }),
    )
  return { store, journal, writeFile, writeJournal, setTime: (value: number) => (time = value) }
}

describe('findRecovery', () => {
  test('nothing in the journal, nothing to recover', async () => {
    const { store, journal } = await setup(1000)
    expect(await findRecovery(store, journal, PATH)).toBeUndefined()
  })

  test('an autosave made on top of the file as it is now is offered, and the file has not changed under it', async () => {
    const { store, journal, writeFile, writeJournal } = await setup(1000)
    const mtime = await writeFile()
    await writeJournal({ savedAt: mtime + 5000, baseMtime: mtime, payload: 'my edits' })
    expect(await findRecovery(store, journal, PATH)).toEqual({
      payload: 'my edits',
      savedAt: mtime + 5000,
      baseChanged: false,
    })
  })

  test('an autosave of a document that was never saved is offered', async () => {
    const { store, journal, writeJournal } = await setup(1000)
    await writeJournal({ savedAt: 2000, baseMtime: null, payload: 'draft' })
    expect(await findRecovery(store, journal, PATH)).toEqual({
      payload: 'draft',
      savedAt: 2000,
      baseChanged: false,
    })
  })

  test('an autosave of a file that has since been deleted is offered, with the warning', async () => {
    const { store, journal, writeJournal } = await setup(1000)
    await writeJournal({ savedAt: 2000, baseMtime: 900, payload: 'draft' })
    expect(await findRecovery(store, journal, PATH)).toMatchObject({ payload: 'draft', baseChanged: true })
  })

  test('an autosave exactly as old as the file is still offered', async () => {
    const { store, journal, writeFile, writeJournal } = await setup(1000)
    const mtime = await writeFile()
    await writeJournal({ savedAt: mtime, baseMtime: mtime })
    expect(await findRecovery(store, journal, PATH)).toBeDefined()
  })

  test('an autosave older than the file is not offered, and is left alone', async () => {
    const { store, journal, writeFile, writeJournal } = await setup(1000)
    const mtime = await writeFile()
    await writeJournal({ savedAt: mtime - 1, baseMtime: mtime - 100 })
    expect(await findRecovery(store, journal, PATH)).toBeUndefined()
    expect(await journal.read(journalPath(PATH))).toBeDefined()
  })

  test('a file that changed after the autosave was based on it is flagged, so Restore can warn about the hand edit', async () => {
    const { store, journal, writeFile, writeJournal } = await setup(1000)
    const mtime = await writeFile()
    await writeJournal({ savedAt: mtime + 10, baseMtime: mtime - 500, payload: 'mine' })
    expect(await findRecovery(store, journal, PATH)).toEqual({
      payload: 'mine',
      savedAt: mtime + 10,
      baseChanged: true,
    })
  })

  test('a journal that names another document is ignored', async () => {
    const { store, journal, writeJournal } = await setup(1000)
    await writeJournal({ path: 'stages/other.toml', savedAt: 5000 })
    expect(await findRecovery(store, journal, PATH)).toBeUndefined()
  })

  test('a journal that cannot be read is ignored', async () => {
    const { store, journal } = await setup(1000)
    await journal.write(journalPath(PATH), '{this is not json')
    expect(await findRecovery(store, journal, PATH)).toBeUndefined()
  })
})

describe('discardRecovery', () => {
  test('removes the journal', async () => {
    const { journal, writeJournal } = await setup(1000)
    await writeJournal({ savedAt: 5000 })
    await discardRecovery(journal, PATH)
    expect(await journal.list()).toEqual([])
  })

  test('is fine when there is none', async () => {
    const { journal } = await setup(1000)
    await expect(discardRecovery(journal, PATH)).resolves.toBeUndefined()
  })
})

describe('findRecovery after a reload, on a clock that keeps whole seconds', () => {
  // The session's mtime after a same-second save is the store's own token (file-versions.ts); a new tab's store
  // knows only the file's lastModified. The journal's base must still match the file it was made on.
  const frozen = () => 1_700_000_000_000

  async function savedThenEdited() {
    const root = createFakeOpfs({ now: frozen })
    const journalRoot = createFakeOpfs({ now: frozen })
    const store = createHandleStore(root, { kind: 'opfs' })
    const journal = createHandleStore(journalRoot, { kind: 'opfs' })
    const opened = await store.write(PATH, '{"n":0}')
    if (!opened.ok) throw new Error('write should succeed')
    const history = createHistory<{ n: number }>({ n: 0 })
    const session = createDocumentSession({
      store,
      journal,
      path: PATH,
      history,
      serializeFile: (state) => JSON.stringify(state),
      snapshot: (state) => JSON.stringify(state),
      mtime: opened.mtime,
      clock: createTestClock(1_700_000_000_500),
    })
    history.apply('set 1', () => ({ n: 1 }))
    expect(await session.save()).toEqual({ status: 'saved', path: PATH })
    history.apply('set 2', () => ({ n: 2 }))
    await session.flush()
    session.dispose()
    return { root, journalRoot }
  }

  test('the file the autosave was made on has not changed', async () => {
    const { root, journalRoot } = await savedThenEdited()
    const reloaded = await findRecovery(
      createHandleStore(root, { kind: 'opfs' }),
      createHandleStore(journalRoot, { kind: 'opfs' }),
      PATH,
    )
    expect(reloaded).toMatchObject({ payload: '{"n":2}', baseChanged: false })
  })

  test('another tab changed the file after the save, in the same second: the base changed', async () => {
    const { root, journalRoot } = await savedThenEdited()
    await createHandleStore(root, { kind: 'opfs' }).write(PATH, '{"n":9}')
    const reloaded = await findRecovery(
      createHandleStore(root, { kind: 'opfs' }),
      createHandleStore(journalRoot, { kind: 'opfs' }),
      PATH,
    )
    expect(reloaded).toMatchObject({ payload: '{"n":2}', baseChanged: true })
  })
})
