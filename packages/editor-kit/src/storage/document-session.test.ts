import { describe, expect, test, vi } from 'vitest'
import { createHistory, type History } from '../history/history'
import { createTestClock } from '../testing/test-clock'
import { createDocumentSession, type DocumentSessionOptions, type Problem } from './document-session'
import { parseJournalEntry } from './journal-entry'
import { createMemoryStore } from './memory-store'
import type { ProjectStore, WriteResult } from './project-store'
import { statPath } from './project-store'
import { discardRecovery, findRecovery } from './recovery'
import type { SaveState } from './save-state'

const START = 1_700_000_000_000
const PATH = 'stages/a.toml'

interface State {
  n: number
}

const decode = (bytes: Uint8Array | undefined): string | undefined =>
  bytes === undefined ? undefined : new TextDecoder().decode(bytes)
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

/** A store whose next writes can fail or wait, to put the session through the failures of §6. */
function controllable(inner: ProjectStore) {
  const failures: WriteResult[] = []
  let gate: Promise<void> | undefined
  const store: ProjectStore = {
    ...inner,
    async write(path, data, expected) {
      if (gate !== undefined) await gate
      const failure = failures.shift()
      if (failure !== undefined) return failure
      return inner.write(path, data, expected)
    },
  }
  return {
    store,
    failNext(result: WriteResult) {
      failures.push(result)
    },
    hold() {
      let open!: () => void
      gate = new Promise((resolve) => {
        open = resolve
      })
      return () => {
        gate = undefined
        open()
      }
    },
  }
}

async function setup(
  options: {
    exists?: boolean
    deviceOnly?: boolean
    serializeFile?: DocumentSessionOptions<State>['serializeFile']
  } = {},
) {
  const clock = createTestClock(START)
  const store = createMemoryStore({ now: clock.now })
  const journal = createMemoryStore({ now: clock.now })
  const control = controllable(store)
  let mtime: number | undefined
  if (options.exists !== false) {
    const first = await store.write(PATH, 'n = 0')
    mtime = first.ok ? first.mtime : undefined
    clock.advance(1000)
  }
  const history: History<State> = createHistory<State>({ n: 0 }, { now: clock.now })
  const problems: Problem[] = []
  const session = createDocumentSession<State>({
    store: control.store,
    journal,
    path: PATH,
    history,
    serializeFile: options.serializeFile ?? ((state) => `n = ${state.n}`),
    snapshot: (state) => JSON.stringify(state),
    mtime,
    deviceOnly: options.deviceOnly ?? false,
    clock,
    onproblem: (problem) => problems.push(problem),
  })
  const statuses: SaveState[] = []
  session.subscribe(() => statuses.push(session.status))
  const edit = (n: number): void => history.apply(`set ${n}`, () => ({ n }))
  return { clock, store, journal, control, history, session, problems, statuses, edit, mtime }
}

describe('document session: saving', () => {
  test('a new session on a file that was just opened is saved', async () => {
    const { session } = await setup()
    expect(session.status).toBe('saved')
    expect(session.problem).toBeUndefined()
  })

  test('an edit makes it dirty', async () => {
    const { session, edit } = await setup()
    edit(1)
    expect(session.status).toBe('dirty')
  })

  test('save writes the serialized document, marks the history clean and removes the journal', async () => {
    const { session, edit, store, journal, history, clock } = await setup()
    edit(1)
    clock.advance(800)
    await settle()
    expect(await statPath(journal, 'stages/a.toml.autosave')).toBeDefined()
    expect(await session.save()).toEqual({ status: 'saved', path: PATH })
    expect(decode(await store.read(PATH))).toBe('n = 1')
    expect(history.revision).toBe(history.cleanRevision)
    expect(await journal.list()).toEqual([])
    expect(session.status).toBe('saved')
  })

  test('the status goes dirty, saving, saved, and the subscriber hears each step', async () => {
    const { session, edit, statuses } = await setup()
    edit(1)
    await session.save()
    expect(statuses).toEqual(['dirty', 'saving', 'saved'])
  })

  test('a second save uses the mtime the first one got', async () => {
    const { session, edit } = await setup()
    edit(1)
    await session.save()
    edit(2)
    expect(await session.save()).toEqual({ status: 'saved', path: PATH })
  })

  test('two saves started together are done one after the other, not against each other', async () => {
    const { session, edit } = await setup()
    edit(1)
    const [first, second] = await Promise.all([session.save(), session.save()])
    expect(first.status).toBe('saved')
    expect(second.status).toBe('saved')
  })

  test('a file changed on disk is a conflict: nothing is overwritten and the document stays dirty (EK-e)', async () => {
    const { session, edit, store, clock } = await setup()
    clock.advance(500)
    await store.write(PATH, 'hand edit')
    edit(1)
    expect(await session.save()).toEqual({ status: 'conflict' })
    expect(decode(await store.read(PATH))).toBe('hand edit')
    expect(session.status).toBe('dirty')
    expect(session.problem).toBeUndefined()
  })

  test('Keep mine writes over the changed file, and the session carries on from there', async () => {
    const { session, edit, store, clock } = await setup()
    clock.advance(500)
    await store.write(PATH, 'hand edit')
    edit(1)
    await session.save()
    expect(await session.overwrite()).toEqual({ status: 'saved', path: PATH })
    expect(decode(await store.read(PATH))).toBe('n = 1')
    expect(session.status).toBe('saved')
    edit(2)
    expect(await session.save()).toEqual({ status: 'saved', path: PATH })
  })

  test('a file removed from under it is a conflict too', async () => {
    const { session, edit, store } = await setup()
    await store.remove(PATH)
    edit(1)
    expect(await session.save()).toEqual({ status: 'conflict' })
  })

  describe('save as copy', () => {
    test('writes next to the file as "name copy", then "name copy 2", leaving the document as it was', async () => {
      const { session, edit, store, history } = await setup()
      edit(1)
      expect(await session.saveCopy()).toEqual({ status: 'saved', path: 'stages/a copy.toml' })
      expect(await session.saveCopy()).toEqual({ status: 'saved', path: 'stages/a copy 2.toml' })
      expect(decode(await store.read('stages/a copy.toml'))).toBe('n = 1')
      expect(decode(await store.read(PATH))).toBe('n = 0')
      expect(history.revision).not.toBe(history.cleanRevision)
      expect(session.status).toBe('dirty')
    })

    test('does not take a name that is only a prefix of another', async () => {
      const { session, store } = await setup()
      await store.write('stages/a copy.toml.bak', 'x')
      expect(await session.saveCopy()).toEqual({ status: 'saved', path: 'stages/a copy.toml' })
    })

    test.each([
      ['README', 'README copy'],
      ['.hidden', '.hidden copy'],
      ['deep/er/name.v2.json', 'deep/er/name.v2 copy.json'],
      ['top.txt', 'top copy.txt'],
    ])('names a copy of %s', async (path, expected) => {
      const store = createMemoryStore()
      const session = createDocumentSession<State>({
        store,
        journal: createMemoryStore(),
        path,
        history: createHistory<State>({ n: 0 }),
        serializeFile: () => 'x',
        snapshot: () => '',
        mtime: undefined,
      })
      expect(await session.saveCopy()).toEqual({ status: 'saved', path: expected })
    })

    test('a failing copy is a failed save', async () => {
      const { session, control } = await setup()
      control.failNext({ ok: false, reason: 'quota', message: 'Storage is full.' })
      expect(await session.saveCopy()).toEqual({
        status: 'failed',
        reason: 'quota',
        message: 'Storage is full.',
      })
      expect(session.status).toBe('error')
    })
  })

  describe('a document with no file yet', () => {
    test('the first save creates it, and the next one is guarded by the new mtime', async () => {
      const { session, edit, store } = await setup({ exists: false })
      edit(1)
      expect(await session.save()).toEqual({ status: 'saved', path: PATH })
      expect(decode(await store.read(PATH))).toBe('n = 1')
      edit(2)
      expect(await session.save()).toEqual({ status: 'saved', path: PATH })
    })

    test('a file that appeared in the meantime is a conflict, not an overwrite', async () => {
      const { session, edit, store } = await setup({ exists: false })
      await store.write(PATH, 'someone else')
      edit(1)
      expect(await session.save()).toEqual({ status: 'conflict' })
      expect(decode(await store.read(PATH))).toBe('someone else')
    })
  })

  test('a document edited while its save is in flight stays dirty and keeps being journaled', async () => {
    const { session, edit, control, history, clock, journal, store } = await setup()
    edit(1)
    const release = control.hold()
    const saving = session.save()
    await settle()
    expect(session.status).toBe('saving')
    edit(2)
    release()
    expect(await saving).toEqual({ status: 'saved', path: PATH })
    expect(history.revision).not.toBe(history.cleanRevision)
    expect(session.status).toBe('dirty')
    clock.advance(800)
    await settle()
    const bytes = await journal.read('stages/a.toml.autosave')
    const entry = bytes === undefined ? undefined : parseJournalEntry(bytes)
    expect(entry?.payload).toBe('{"n":2}')
    expect(entry?.baseMtime).toBe((await statPath(store, PATH))?.mtime)
  })

  describe('failures', () => {
    test.each(['quota', 'denied', 'io', 'policy'] as const)(
      '%s is a failed save with that reason: status error, one problem reported, the document still dirty',
      async (reason) => {
        const { session, edit, control, problems, history } = await setup()
        edit(1)
        control.failNext({ ok: false, reason, message: 'Nope.' })
        expect(await session.save()).toEqual({ status: 'failed', reason, message: 'Nope.' })
        expect(session.status).toBe('error')
        expect(session.problem).toEqual({ source: 'save', reason, message: 'Nope.', paused: false })
        expect(problems).toEqual([{ source: 'save', reason, message: 'Nope.', paused: false }])
        expect(history.revision).not.toBe(history.cleanRevision)
      },
    )

    test('a later save that works clears the error', async () => {
      const { session, edit, control } = await setup()
      edit(1)
      control.failNext({ ok: false, reason: 'io', message: 'Nope.' })
      await session.save()
      expect(await session.save()).toEqual({ status: 'saved', path: PATH })
      expect(session.status).toBe('saved')
      expect(session.problem).toBeUndefined()
    })

    test('a document that cannot be serialized is a failed save and nothing is written', async () => {
      const { session, edit, store } = await setup({
        serializeFile: () => {
          throw new Error('cannot serialize')
        },
      })
      edit(1)
      expect(await session.save()).toEqual({ status: 'failed', reason: 'io', message: 'cannot serialize' })
      expect(decode(await store.read(PATH))).toBe('n = 0')
      expect(session.status).toBe('error')
    })

    test('autosave running out of quota is shown the same way and reported once, as a paused autosave', async () => {
      const { session, edit, clock, journal, problems } = await setup()
      journal.write = async () => ({ ok: false, reason: 'quota', message: 'Storage is full.' })
      edit(1)
      clock.advance(800)
      await settle()
      expect(session.status).toBe('error')
      expect(session.problem).toEqual({
        source: 'autosave',
        reason: 'quota',
        message: 'Storage is full.',
        paused: true,
      })
      expect(problems).toHaveLength(1)
    })

    test('when a save and an autosave have both failed, the save problem is the one shown', async () => {
      const { session, edit, clock, journal, control } = await setup()
      journal.write = async () => ({ ok: false, reason: 'io', message: 'Journal failed.' })
      edit(1)
      clock.advance(800)
      await settle()
      expect(session.problem?.source).toBe('autosave')
      control.failNext({ ok: false, reason: 'quota', message: 'Disk full.' })
      await session.save()
      expect(session.problem).toEqual({
        source: 'save',
        reason: 'quota',
        message: 'Disk full.',
        paused: false,
      })
    })

    test('saving the document makes a paused autosave moot: the error clears and autosave starts again', async () => {
      const { session, edit, clock, journal } = await setup()
      const write = journal.write.bind(journal)
      journal.write = async () => ({ ok: false, reason: 'quota', message: 'Storage is full.' })
      edit(1)
      clock.advance(800)
      await settle()
      await session.save()
      expect(session.status).toBe('saved')
      expect(session.problem).toBeUndefined()
      journal.write = write
      edit(2)
      clock.advance(800)
      await settle()
      expect(await statPath(journal, 'stages/a.toml.autosave')).toBeDefined()
    })
  })

  describe('a device that keeps nothing', () => {
    test('shows "device" whether or not there are edits, until something goes wrong', async () => {
      const { session, edit, control } = await setup({ deviceOnly: true })
      expect(session.status).toBe('device')
      edit(1)
      expect(session.status).toBe('device')
      await session.save()
      expect(session.status).toBe('device')
      edit(2)
      control.failNext({ ok: false, reason: 'io', message: 'Nope.' })
      await session.save()
      expect(session.status).toBe('error')
    })
  })
})

describe('document session: the journal', () => {
  test('flush writes the journal now', async () => {
    const { session, edit, journal } = await setup()
    edit(1)
    await session.flush()
    expect(await statPath(journal, 'stages/a.toml.autosave')).toBeDefined()
  })

  test('discardJournal removes it', async () => {
    const { session, edit, journal } = await setup()
    edit(1)
    await session.flush()
    await session.discardJournal()
    expect(await journal.list()).toEqual([])
  })

  test('three edits, the tab killed, the page reopened: Restore offers them and reproduces the state; Discard deletes (EK-d)', async () => {
    const first = await setup()
    first.edit(1)
    first.edit(2)
    first.edit(3)
    first.clock.advance(800)
    await settle()
    // The tab dies here: no save, no dispose. The workspace is all that is left.
    const { store, journal } = first
    const found = await findRecovery(store, journal, PATH)
    expect(found).toMatchObject({ payload: '{"n":3}', baseChanged: false })
    const reopened = createHistory<State>({ n: 0 })
    reopened.apply('Restore autosave', () => JSON.parse(found?.payload ?? '{}') as State)
    expect(reopened.state).toEqual({ n: 3 })
    expect(reopened.revision).not.toBe(reopened.cleanRevision)
    await discardRecovery(journal, PATH)
    expect(await findRecovery(store, journal, PATH)).toBeUndefined()
  })
})

describe('document session: listening', () => {
  test('a drag changes nothing the status line shows, so nobody is told', async () => {
    const { session, history } = await setup()
    const heard = vi.fn()
    session.subscribe(heard)
    const drag = history.begin('drag')
    drag.update(() => ({ n: 1 }))
    drag.update(() => ({ n: 2 }))
    expect(heard).not.toHaveBeenCalled()
    drag.cancel()
  })

  test('subscribe returns a way to stop', async () => {
    const { session, edit } = await setup()
    const heard = vi.fn()
    const stop = session.subscribe(heard)
    stop()
    edit(1)
    expect(heard).not.toHaveBeenCalled()
  })

  test('after dispose nothing is written and nobody is told', async () => {
    const { session, edit, clock, journal, statuses } = await setup()
    session.dispose()
    edit(1)
    clock.advance(5000)
    await settle()
    expect(await journal.list()).toEqual([])
    expect(statuses).toEqual([])
  })

  test('after dispose a subscriber that arrives late is not told either', async () => {
    const { session, edit } = await setup()
    session.dispose()
    const heard = vi.fn()
    session.subscribe(heard)
    edit(1)
    expect(heard).not.toHaveBeenCalled()
  })

  test('a save that finishes after dispose tells nobody', async () => {
    const { session, edit, control, statuses } = await setup()
    edit(1)
    const release = control.hold()
    const saving = session.save()
    await settle()
    session.dispose()
    const heardBefore = statuses.length
    release()
    await saving
    expect(statuses).toHaveLength(heardBefore)
  })

  test('the subscriber hears saving as soon as a write begins, whatever the save turns into', async () => {
    const { session, edit, control, statuses } = await setup()
    edit(1)
    const release = control.hold()
    const saving = session.save()
    await settle()
    expect(statuses).toEqual(['dirty', 'saving'])
    control.failNext({ ok: false, reason: 'io', message: 'Nope.' })
    release()
    await saving
    expect(statuses).toEqual(['dirty', 'saving', 'error'])
  })
})
