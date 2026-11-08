import { beforeEach, describe, expect, it } from 'vitest'
import { type SyncHandle, startSync } from '#src/shared/kit/sync/sync-loop.ts'
import { FakeEngine, FakeTimers, FakeVisibility, settle } from './fake-sync'

let engine: FakeEngine
let timers: FakeTimers
let visibility: FakeVisibility
let signedIn: boolean
let told: string[][]
let started: SyncHandle[]

const start = async (): Promise<SyncHandle> => {
  const handle = startSync({
    engine,
    store: { notifyChanged: (paths) => told.push([...paths]) },
    timers,
    visibility,
    isSignedIn: async () => signedIn,
  })
  started.push(handle)
  await settle()
  return handle
}

beforeEach(() => {
  for (const handle of started ?? []) handle.stop()
  engine = new FakeEngine()
  timers = new FakeTimers()
  visibility = new FakeVisibility()
  signedIn = true
  told = []
  started = []
})

describe('startSync: pulling', () => {
  it('pulls when it starts, when the app comes back, and every 60 seconds', async () => {
    await start()
    expect(engine.calls).toEqual(['fetch'])
    visibility.set(false)
    visibility.set(true)
    await settle()
    expect(engine.calls).toEqual(['fetch', 'fetch'])
    await timers.advance(60_000)
    expect(engine.calls).toEqual(['fetch', 'fetch', 'fetch'])
  })

  it('does not pull while the app is hidden', async () => {
    await start()
    visibility.set(false)
    await timers.advance(180_000)
    expect(engine.calls).toEqual(['fetch'])
  })

  it('merges nothing when GitHub has nothing new', async () => {
    await start()
    expect(engine.calls).not.toContain('merge')
  })

  it('merges what is new and tells the editors which files changed', async () => {
    engine.remoteChanged = true
    engine.pull = { changed: ['content/feel.toml'], asks: [], generated: [] }
    const handle = await start()
    expect(engine.calls).toEqual(['fetch', 'merge'])
    expect(told).toEqual([['content/feel.toml']])
    expect(handle.status.get().state).toBe('saved')
  })

  it('asks the person when a file changed on both sides', async () => {
    engine.remoteChanged = true
    engine.pull = {
      changed: [],
      asks: [{ path: 'content/feel.toml', reason: 'both-changed' }],
      generated: [],
    }
    const handle = await start()
    expect(handle.status.get()).toEqual({
      state: 'conflict',
      line: 'A file changed here and on GitHub. Choose which to keep.',
    })
  })

  it('says when Claude edited a file the app rebuilds', async () => {
    engine.remoteChanged = true
    engine.pull = { changed: [], asks: [], generated: ['content/levels/start.toml'] }
    const handle = await start()
    expect(handle.status.get().line).toBe(
      "Claude edited content/levels/start.toml, but the app rebuilds that file from your level. Claude's edit is kept on GitHub, not in the game.",
    )
  })
})

describe('startSync: saving', () => {
  it('makes one commit 10 seconds after the last save, naming what was edited', async () => {
    const handle = await start()
    handle.edited(['content/feel.toml'])
    await timers.advance(6000)
    handle.edited(['content/levels/start.af2d.json'])
    await timers.advance(6000)
    expect(engine.commits).toEqual([])
    await timers.advance(4000)
    expect(engine.commits).toEqual(['Edited in Automata: Feel, Levels (Start)'])
    expect(engine.calls.slice(-2)).toEqual(['commit', 'push'])
    expect(handle.status.get()).toEqual({ state: 'saved', line: 'Saved and on GitHub' })
  })

  it('makes no commit when nothing was edited', async () => {
    await start()
    await timers.advance(30_000)
    expect(engine.commits).toEqual([])
  })

  it('shows offline at the push, and the next pull pushes the same commit with no second one', async () => {
    const handle = await start()
    engine.online = false
    handle.edited(['content/feel.toml'])
    await timers.advance(10_000)
    expect(handle.status.get()).toEqual({
      state: 'offline',
      line: 'Saved on this device. Not on GitHub yet: no internet.',
    })
    engine.online = true
    await timers.advance(60_000)
    expect(engine.commits).toHaveLength(1)
    expect(engine.calls.filter((call) => call === 'push')).toHaveLength(2)
    expect(handle.status.get().state).toBe('saved')
  })

  it('pushes a commit left from before the app was quit, as the same single commit', async () => {
    engine.unpushedShas = ['left-behind']
    const handle = await start()
    expect(engine.commits).toEqual([])
    expect(engine.calls).toEqual(['fetch', 'push'])
    expect(handle.status.get().state).toBe('saved')
  })

  it('keeps the commit but does not push when signed out', async () => {
    signedIn = false
    const handle = await start()
    expect(engine.calls).toEqual([])
    handle.edited(['content/feel.toml'])
    await timers.advance(10_000)
    expect(engine.commits).toHaveLength(1)
    expect(engine.calls).not.toContain('push')
    expect(handle.status.get()).toEqual({
      state: 'signed-out',
      line: 'Saved on this device. Not on GitHub yet: sign in to GitHub.',
    })
  })

  it('pulls and tries once more when GitHub moved on, and never forces', async () => {
    const handle = await start()
    engine.pushAnswers = ['rejected', 'pushed']
    handle.edited(['content/feel.toml'])
    await timers.advance(10_000)
    expect(engine.calls).toEqual(['fetch', 'commit', 'push', 'fetch', 'push'])
    expect(handle.status.get().state).toBe('saved')
  })
})

describe('startSync: stopping', () => {
  it('stops pulling and saving', async () => {
    const handle = await start()
    handle.stop()
    handle.edited(['content/feel.toml'])
    await timers.advance(120_000)
    expect(engine.calls).toEqual(['fetch'])
  })
})
