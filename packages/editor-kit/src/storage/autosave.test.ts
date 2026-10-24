import { describe, expect, test, vi } from 'vitest'
import { createHistory } from '../history/history'
import { createTestClock } from '../testing/test-clock'
import { type AutosaveProblem, createAutosave } from './autosave'
import { parseJournalEntry } from './journal-entry'
import { createMemoryStore } from './memory-store'
import type { ProjectStore, WriteResult } from './project-store'

const START = 1_700_000_000_000
const PATH = 'stages/a.toml'
const JOURNAL = 'stages/a.toml.autosave'

interface State {
  n: number
}

/** Lets every pending promise callback run (the fake clock fires timers synchronously, the store answers later). */
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

/** A journal that records its writes and can be told to fail or to wait. */
function watchedJournal(clock: { now(): number }) {
  const inner = createMemoryStore({ now: clock.now })
  const writes: string[] = []
  let failWith: WriteResult | undefined
  let failRemove: Error | undefined
  let gate: Promise<void> | undefined
  const store: ProjectStore = {
    ...inner,
    async remove(path) {
      if (failRemove !== undefined) throw failRemove
      return inner.remove(path)
    },
    async write(path, data, expected) {
      if (gate !== undefined) await gate
      if (failWith !== undefined) return failWith
      writes.push(typeof data === 'string' ? data : new TextDecoder().decode(data))
      return inner.write(path, data, expected)
    },
  }
  return {
    store,
    writes,
    failWith(result: WriteResult | undefined) {
      failWith = result
    },
    failRemove(error: Error | undefined) {
      failRemove = error
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

function setup(
  options: { debounceMs?: number; baseMtime?: number; snapshot?: (state: State) => string } = {},
) {
  const clock = createTestClock(START)
  const history = createHistory<State>({ n: 0 }, { now: clock.now })
  const journal = watchedJournal(clock)
  const problems: Array<AutosaveProblem | undefined> = []
  const autosave = createAutosave({
    history,
    journal: journal.store,
    path: PATH,
    snapshot: options.snapshot ?? ((state) => JSON.stringify(state)),
    clock,
    debounceMs: options.debounceMs ?? 800,
    baseMtime: options.baseMtime,
    onproblem: (problem) => problems.push(problem),
  })
  const edit = (n: number): void => history.apply(`set ${n}`, () => ({ n }))
  const payloadOf = async (): Promise<string | undefined> => {
    const bytes = await journal.store.read(JOURNAL)
    return bytes === undefined ? undefined : parseJournalEntry(bytes)?.payload
  }
  return { clock, history, journal, autosave, problems, edit, payloadOf }
}

describe('autosave', () => {
  test('an edit writes the journal after the debounce, not before', async () => {
    const { clock, edit, journal, payloadOf, autosave, problems } = setup()
    edit(1)
    expect(autosave.state).toBe('pending')
    clock.advance(799)
    await settle()
    expect(journal.writes).toEqual([])
    clock.advance(1)
    await settle()
    expect(await payloadOf()).toBe('{"n":1}')
    expect(autosave.state).toBe('idle')
    expect(problems).toEqual([])
  })

  test('another edit before it fires restarts the wait, and one write carries the latest state', async () => {
    const { clock, edit, journal, payloadOf } = setup()
    edit(1)
    clock.advance(500)
    edit(2)
    clock.advance(799)
    await settle()
    expect(journal.writes).toEqual([])
    clock.advance(1)
    await settle()
    expect(journal.writes).toHaveLength(1)
    expect(await payloadOf()).toBe('{"n":2}')
  })

  test('the entry names the path, the time of the write and the file version it was made on', async () => {
    const { clock, edit, journal } = setup({ baseMtime: 1234 })
    edit(1)
    clock.advance(800)
    await settle()
    expect(parseJournalEntry(new TextEncoder().encode(journal.writes[0]))).toEqual({
      path: PATH,
      savedAt: START + 800,
      baseMtime: 1234,
      payload: '{"n":1}',
    })
  })

  test('a document with no file yet has a null base, and setBase changes it for the next write', async () => {
    const { clock, edit, journal, autosave } = setup()
    edit(1)
    clock.advance(800)
    await settle()
    autosave.setBase(5000)
    edit(2)
    clock.advance(800)
    await settle()
    const bases = journal.writes.map((text) => parseJournalEntry(new TextEncoder().encode(text))?.baseMtime)
    expect(bases).toEqual([null, 5000])
  })

  test('a transaction writes nothing while it is open, and its commit writes once (EK-a)', async () => {
    const { clock, history, journal, payloadOf } = setup()
    const drag = history.begin('drag')
    drag.update(() => ({ n: 1 }))
    clock.advance(400)
    drag.update(() => ({ n: 2 }))
    clock.advance(5000)
    await settle()
    expect(journal.writes).toEqual([])
    drag.commit()
    clock.advance(800)
    await settle()
    expect(journal.writes).toHaveLength(1)
    expect(await payloadOf()).toBe('{"n":2}')
  })

  test('a transaction opened while a write is waiting does not restart the wait, and the state is not "pending" because of it', async () => {
    const { clock, edit, history, journal, autosave } = setup()
    edit(1)
    clock.advance(500)
    const drag = history.begin('drag')
    drag.update(() => ({ n: 2 }))
    clock.advance(300)
    await settle()
    expect(journal.writes).toHaveLength(1)
    drag.cancel()
    expect(autosave.state).toBe('idle')
  })

  test('a transaction on a clean document leaves autosave idle', () => {
    const { history, autosave } = setup()
    history.begin('drag').update(() => ({ n: 1 }))
    expect(autosave.state).toBe('idle')
  })

  test('a cancelled transaction writes nothing', async () => {
    const { clock, history, journal } = setup()
    const drag = history.begin('drag')
    drag.update(() => ({ n: 1 }))
    drag.cancel()
    clock.advance(5000)
    await settle()
    expect(journal.writes).toEqual([])
  })

  test('nothing is written for a document that is clean', async () => {
    const { clock, journal, autosave } = setup()
    clock.advance(10_000)
    await autosave.flush()
    expect(journal.writes).toEqual([])
    expect(autosave.state).toBe('idle')
  })

  test('flush writes at once and settles after the write', async () => {
    const { edit, autosave, payloadOf } = setup()
    edit(1)
    await autosave.flush()
    expect(await payloadOf()).toBe('{"n":1}')
    expect(autosave.state).toBe('idle')
  })

  test('flush cancels the wait, so the same state is not written twice', async () => {
    const { clock, edit, autosave, journal } = setup()
    edit(1)
    await autosave.flush()
    clock.advance(5000)
    await settle()
    expect(journal.writes).toHaveLength(1)
  })

  test('flush does not write a state that is already in the journal', async () => {
    const { edit, autosave, journal } = setup()
    edit(1)
    await autosave.flush()
    await autosave.flush()
    expect(journal.writes).toHaveLength(1)
  })

  test('a change while a write is in flight is written after it, one write at a time, and the last state wins', async () => {
    const { clock, edit, journal, payloadOf, autosave } = setup()
    const release = journal.hold()
    edit(1)
    clock.advance(800)
    await settle()
    expect(autosave.state).toBe('writing')
    edit(2)
    expect(autosave.state).toBe('writing')
    clock.advance(800)
    await settle()
    release()
    await settle()
    const written = journal.writes.map((text) => parseJournalEntry(new TextEncoder().encode(text))?.payload)
    expect(written).toEqual(['{"n":1}', '{"n":2}'])
    expect(await payloadOf()).toBe('{"n":2}')
    expect(autosave.state).toBe('idle')
  })

  test('clear waits for a write in flight and then removes the journal, so nothing comes back', async () => {
    const { clock, edit, history, journal, payloadOf, autosave } = setup()
    const release = journal.hold()
    edit(1)
    clock.advance(800)
    await settle()
    history.markClean()
    let cleared = false
    const clearing = autosave.clear().then(() => {
      cleared = true
    })
    await settle()
    expect(cleared).toBe(false)
    release()
    await clearing
    expect(await payloadOf()).toBeUndefined()
  })

  test('clear cancels a write that was still waiting', async () => {
    const { clock, edit, history, journal, autosave } = setup()
    edit(1)
    history.markClean()
    await autosave.clear()
    clock.advance(5000)
    await settle()
    expect(journal.writes).toEqual([])
  })

  test('a journal that cannot be removed does not make clear fail (findRecovery ignores a stale one)', async () => {
    const { edit, history, journal, autosave } = setup()
    edit(1)
    await autosave.flush()
    history.markClean()
    journal.failRemove(new Error('disk'))
    await expect(autosave.clear()).resolves.toBeUndefined()
  })

  test('clear on a journal that is not there is fine', async () => {
    await expect(setup().autosave.clear()).resolves.toBeUndefined()
  })

  test('an edit after a clear writes again', async () => {
    const { clock, edit, history, autosave, payloadOf } = setup()
    edit(1)
    await autosave.flush()
    history.markClean()
    await autosave.clear()
    edit(2)
    clock.advance(800)
    await settle()
    expect(await payloadOf()).toBe('{"n":2}')
  })

  describe('when the journal cannot be written', () => {
    test('quota pauses it: a problem is reported once, and later edits write nothing until resume', async () => {
      const { clock, edit, journal, autosave, problems, payloadOf } = setup()
      journal.failWith({ ok: false, reason: 'quota', message: 'Storage is full.' })
      edit(1)
      clock.advance(800)
      await settle()
      expect(autosave.state).toBe('paused')
      expect(problems).toEqual([{ reason: 'quota', message: 'Storage is full.', paused: true }])
      edit(2)
      clock.advance(5000)
      await settle()
      expect(autosave.state).toBe('paused')
      journal.failWith(undefined)
      expect(await payloadOf()).toBeUndefined()
      autosave.resume()
      clock.advance(800)
      await settle()
      expect(await payloadOf()).toBe('{"n":2}')
      expect(autosave.state).toBe('idle')
      expect(problems.at(-1)).toBeUndefined()
    })

    test('flush does not write while paused', async () => {
      const { clock, edit, journal, autosave } = setup()
      journal.failWith({ ok: false, reason: 'quota', message: 'Storage is full.' })
      edit(1)
      clock.advance(800)
      await settle()
      journal.failWith(undefined)
      await autosave.flush()
      expect(journal.writes).toEqual([])
      expect(autosave.state).toBe('paused')
    })

    test('resume when not paused does not disturb a write that is waiting', async () => {
      const { clock, edit, autosave, journal } = setup()
      edit(1)
      clock.advance(500)
      autosave.resume()
      clock.advance(300)
      await settle()
      expect(journal.writes).toHaveLength(1)
    })

    test('resume after the document was saved in the meantime starts nothing', async () => {
      const { clock, edit, history, journal, autosave } = setup()
      journal.failWith({ ok: false, reason: 'quota', message: 'Storage is full.' })
      edit(1)
      clock.advance(800)
      await settle()
      history.markClean()
      await autosave.clear()
      autosave.resume()
      expect(autosave.state).toBe('idle')
      clock.advance(5000)
      await settle()
      expect(journal.writes).toEqual([])
    })

    test('resume with nothing to save does nothing', async () => {
      const { autosave, journal } = setup()
      autosave.resume()
      await settle()
      expect(journal.writes).toEqual([])
      expect(autosave.state).toBe('idle')
    })

    test.each(['denied', 'io'] as const)(
      '%s is an error, and the next change tries again',
      async (reason) => {
        const { clock, edit, journal, autosave, problems, payloadOf } = setup()
        journal.failWith({ ok: false, reason, message: 'No.' })
        edit(1)
        clock.advance(800)
        await settle()
        expect(autosave.state).toBe('error')
        expect(problems).toEqual([{ reason, message: 'No.', paused: false }])
        journal.failWith(undefined)
        edit(2)
        clock.advance(800)
        await settle()
        expect(await payloadOf()).toBe('{"n":2}')
        expect(autosave.state).toBe('idle')
        expect(problems.at(-1)).toBeUndefined()
      },
    )

    test('flush tries again after an error', async () => {
      const { edit, journal, autosave, payloadOf } = setup()
      journal.failWith({ ok: false, reason: 'io', message: 'Disk.' })
      edit(1)
      await autosave.flush()
      expect(autosave.state).toBe('error')
      journal.failWith(undefined)
      await autosave.flush()
      expect(await payloadOf()).toBe('{"n":1}')
    })

    test('a snapshot that throws is an error, and the history keeps working', async () => {
      const { clock, edit, history, autosave, problems } = setup({
        snapshot: () => {
          throw new Error('cannot serialize')
        },
      })
      edit(1)
      clock.advance(800)
      await settle()
      expect(autosave.state).toBe('error')
      expect(problems).toEqual([{ reason: 'io', message: 'cannot serialize', paused: false }])
      expect(history.state).toEqual({ n: 1 })
      expect(() => edit(2)).not.toThrow()
    })
  })

  describe('dispose', () => {
    test('cancels the wait and writes nothing', async () => {
      const { clock, edit, journal, autosave } = setup()
      edit(1)
      autosave.dispose()
      clock.advance(5000)
      await settle()
      expect(journal.writes).toEqual([])
    })

    test('lets go of the history', () => {
      const history = createHistory<State>({ n: 0 })
      let listening = 0
      const subscribe = history.subscribe.bind(history)
      history.subscribe = (listener) => {
        listening += 1
        const stop = subscribe(listener)
        return () => {
          listening -= 1
          stop()
        }
      }
      const autosave = createAutosave({
        history,
        journal: createMemoryStore(),
        path: PATH,
        snapshot: () => '',
        clock: createTestClock(START),
        debounceMs: 800,
      })
      expect(listening).toBe(1)
      autosave.dispose()
      expect(listening).toBe(0)
    })

    test('stops listening to the history', async () => {
      const { clock, edit, journal, autosave } = setup()
      autosave.dispose()
      edit(1)
      clock.advance(5000)
      await autosave.flush()
      expect(journal.writes).toEqual([])
    })
  })

  test('refuses a document path that cannot have a journal', () => {
    const clock = createTestClock(START)
    expect(() =>
      createAutosave({
        history: createHistory<State>({ n: 0 }),
        journal: createMemoryStore(),
        path: '../escape.toml',
        snapshot: () => '',
        clock,
        debounceMs: 800,
      }),
    ).toThrow(RangeError)
  })

  test('uses the clock it is given for the wait', async () => {
    const setTimer = vi.fn(() => 1)
    const clock = { now: () => START, setTimer, clearTimer: vi.fn() }
    const history = createHistory<State>({ n: 0 })
    createAutosave({
      history,
      journal: createMemoryStore(),
      path: PATH,
      snapshot: () => '',
      clock,
      debounceMs: 123,
    })
    history.apply('x', () => ({ n: 1 }))
    expect(setTimer).toHaveBeenCalledWith(123, expect.any(Function))
  })
})
