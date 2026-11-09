import { describe, expect, it, vi } from 'vitest'
import { createMemoryStore } from '#src/shared/kit/storage/memory-store.ts'
import type { WebGitHubSession } from '#src/shared/kit/sync/web-sign-in.ts'
import { startWebSync } from '#src/shared/kit/sync/web-sync.ts'
import { createFakeGitHubRest } from '#src/testing/kit/fake-github-rest.ts'
import { FakeTimers, FakeVisibility, settle } from './fake-sync.ts'

// A web game kept on GitHub (spec 8.1, 8.2): it pulls when it opens, an edit goes to GitHub as one commit ten seconds
// later, and the line at the top says where the work is. The page's globals (timers, visibility) are handed in.

const LIST = 'format = "af-editors/1"\n'
const FEEL = 'path = "content/feel/feel.toml"'
const encoder = new TextEncoder()
const decoder = new TextDecoder()

function session(state: { signedIn: boolean }): WebGitHubSession {
  return {
    get signedIn() {
      return state.signedIn
    },
    token: async () => (state.signedIn ? 'ghu_1' : undefined),
    login: async () => 'me',
    signIn: vi.fn(),
    signOut: async () => undefined,
    subscribe: () => () => undefined,
  }
}

async function open(
  options: { files?: Record<string, string>; remote?: Record<string, string> | 'empty' } = {},
) {
  const github = createFakeGitHubRest({
    repo: 'me/game',
    ...(options.remote === 'empty'
      ? {}
      : { files: options.remote ?? { 'content/editors.toml': LIST, [FEEL]: 'flash = 1\n' } }),
  })
  const store = createMemoryStore()
  for (const [path, text] of Object.entries(options.files ?? {})) await store.write(path, text)
  const timers = new FakeTimers()
  const state = { signedIn: true }
  const pulled: string[][] = []
  const sync = startWebSync({
    fetch: github.fetch,
    session: session(state),
    store,
    repo: 'me/game',
    timers,
    visibility: new FakeVisibility(),
    now: () => 1_000_000 + timers.now,
  })
  sync.onPulled((paths) => pulled.push([...paths]))
  // The first pull hashes files with the browser's crypto, which settles in its own time: wait for its end.
  await vi.waitFor(() => expect(sync.status.get().state).toBe('saved'))
  if (options.remote !== 'empty') await vi.waitFor(() => expect(pulled.length).toBeGreaterThan(0))
  await settle()
  const text = async (path: string) => {
    const bytes = await store.read(path)
    return bytes === undefined ? undefined : decoder.decode(bytes)
  }
  return { github, store, timers, state, pulled, sync, text }
}

describe('a web game kept on GitHub', () => {
  it('pulls when it opens: what GitHub has arrives, the editors are told, and the line says it is kept', async () => {
    const game = await open()
    expect(await game.text('content/editors.toml')).toBe(LIST)
    expect(game.pulled.flat().sort()).toEqual([FEEL, 'content/editors.toml'].sort())
    expect(game.sync.status.get().line).toBe('Saved on this device and on GitHub')
  })

  it('puts a game that was only on this device into the empty place made for it, without waiting for an edit', async () => {
    const game = await open({
      remote: 'empty',
      files: { 'content/editors.toml': LIST, [FEEL]: 'flash = 2\n' },
    })
    await vi.waitFor(() => expect(game.github.file(FEEL)).toBe('flash = 2\n'))
    expect(game.github.file('content/editors.toml')).toBe(LIST)
    await vi.waitFor(() => expect(game.sync.status.get().line).toBe('Saved on this device and on GitHub'))
  })

  it('sends an edit the page was closed on before ten seconds passed, the next time the game opens', async () => {
    const game = await open()
    await game.store.write(FEEL, encoder.encode('flash = 4\n'))
    // No `edited` call: the page went away first. A new page opens the same files.
    const next = startWebSync({
      fetch: game.github.fetch,
      session: session({ signedIn: true }),
      store: game.store,
      repo: 'me/game',
      timers: new FakeTimers(),
      visibility: new FakeVisibility(),
    })
    await vi.waitFor(() => expect(game.github.file(FEEL)).toBe('flash = 4\n'))
    next.stop()
  })

  it('commits an edit ten seconds after the last one, as “Edited in Automata: Feel”', async () => {
    const game = await open()
    await game.store.write(FEEL, encoder.encode('flash = 3\n'))
    game.sync.edited([FEEL])
    await game.timers.advance(9_000)
    expect(game.github.file(FEEL)).toBe('flash = 1\n')
    await game.timers.advance(1_500)
    await vi.waitFor(() => expect(game.github.file(FEEL)).toBe('flash = 3\n'))
    expect(game.github.messages().at(-1)).toBe('Edited in Automata: Feel')
    await vi.waitFor(() => expect(game.sync.status.get().state).toBe('saved'))
    expect(game.sync.status.get().line).toBe('Saved on this device and on GitHub')
  })

  it('says it is saved on this device and not on GitHub yet when there is no internet, and catches up when it is back', async () => {
    const game = await open()
    game.github.state.offline = true
    await game.store.write(FEEL, encoder.encode('flash = 5\n'))
    game.sync.edited([FEEL])
    await game.timers.advance(10_500)
    await vi.waitFor(() =>
      expect(game.sync.status.get().line).toBe('Saved on this device. Not on GitHub yet: no internet.'),
    )
    game.github.state.offline = false
    await game.sync.pullNow()
    expect(game.github.file(FEEL)).toBe('flash = 5\n')
    expect(game.sync.status.get().line).toBe('Saved on this device and on GitHub')
  })

  it('after signing out says to sign in to GitHub, and never touches GitHub', async () => {
    const game = await open()
    const calls = game.github.log.length
    game.state.signedIn = false
    await game.store.write(FEEL, encoder.encode('flash = 7\n'))
    game.sync.edited([FEEL])
    await game.timers.advance(10_500)
    await vi.waitFor(() =>
      expect(game.sync.status.get().line).toBe('Saved on this device. Not on GitHub yet: sign in to GitHub.'),
    )
    expect(game.github.log.length).toBe(calls)
  })

  it('a change made on GitHub reaches the open game on the next pull, and the editors are told which file', async () => {
    const game = await open()
    game.pulled.length = 0
    await game.github.remoteWrite({ [FEEL]: 'flash = 9\n' })
    await game.timers.advance(60_500)
    await vi.waitFor(() => expect(game.pulled).toEqual([[FEEL]]))
    expect(await game.text(FEEL)).toBe('flash = 9\n')
  })

  it('stop() ends the timers', async () => {
    const game = await open()
    game.sync.stop()
    const calls = game.github.log.length
    await game.timers.advance(120_000)
    expect(game.github.log.length).toBe(calls)
  })
})
