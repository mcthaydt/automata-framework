import { describe, expect, it } from 'vitest'
import { type GitEngine, OfflineError, SyncStopped } from '#src/shared/kit/sync/git-engine.ts'
import { startSync } from '#src/shared/kit/sync/sync-loop.ts'
import { FakeTimers, FakeVisibility, settle } from './fake-sync.ts'

// An engine that can't go on (a game too big for the web, GitHub asking for a wait) stops the loop with words, not with
// "no internet", and the loop pulls no more until the wait is over or the person acts.

function engine(behaviour: {
  fetch: () => Promise<'unchanged' | 'changed'>
}): GitEngine & { fetched: number } {
  const made = {
    fetched: 0,
    fetchMain: () => {
      made.fetched += 1
      return behaviour.fetch()
    },
    mergeMain: () => Promise.resolve({ changed: [], asks: [], generated: [] }),
    commitAll: () => Promise.resolve(undefined),
    hasUnpushed: () => Promise.resolve(false),
    push: () => Promise.resolve('pushed' as const),
  }
  return made
}

function start(made: GitEngine, now: () => number = () => 0) {
  const timers = new FakeTimers()
  const handle = startSync({
    engine: made,
    store: { notifyChanged: () => undefined },
    timers,
    visibility: new FakeVisibility(),
    isSignedIn: () => Promise.resolve(true),
    now,
  })
  return { handle, timers }
}

describe('a sync that is stopped', () => {
  it('says the engine’s words after "Saved on this device.", never "no internet", and pulls no more', async () => {
    const made = engine({
      fetch: () =>
        Promise.reject(new SyncStopped('This game is too big to sync on the web. Use the Automata app.')),
    })
    const { handle, timers } = start(made)
    await settle()
    expect(handle.status.get()).toEqual({
      state: 'stopped',
      line: 'Saved on this device. This game is too big to sync on the web. Use the Automata app.',
    })
    await timers.advance(180_000)
    expect(made.fetched).toBe(1)
  })

  it('goes on when the person acts', async () => {
    let stop = true
    const made = engine({
      fetch: () =>
        stop ? Promise.reject(new SyncStopped('Stopped.')) : Promise.resolve('unchanged' as const),
    })
    const { handle } = start(made)
    await settle()
    stop = false
    await handle.pullNow()
    expect(made.fetched).toBe(2)
    expect(handle.status.get().state).toBe('saved')
  })

  it('goes on by itself once the wait GitHub asked for is over', async () => {
    let clock = 0
    let wait = true
    const made = engine({
      fetch: () =>
        wait
          ? Promise.reject(
              new SyncStopped('GitHub asked us to wait. Your game is saved on this device.', 90_000),
            )
          : Promise.resolve('unchanged' as const),
    })
    const { handle, timers } = start(made, () => clock)
    await settle()
    expect(handle.status.get().state).toBe('stopped')
    wait = false
    clock = 60_000
    await timers.advance(60_000)
    expect(made.fetched).toBe(1)
    clock = 120_000
    await timers.advance(60_000)
    expect(made.fetched).toBe(2)
    expect(handle.status.get().state).toBe('saved')
  })

  it('still calls a missing network offline', async () => {
    const { handle } = start(engine({ fetch: () => Promise.reject(new OfflineError()) }))
    await settle()
    expect(handle.status.get().state).toBe('offline')
  })
})
