import { createMemoryStore } from '@automata/editor/kit'
import type { WebGitHubSession } from '@automata/editor/kit/web-sync'
import { describe, expect, it, vi } from 'vitest'
import { keepOnGitHub } from '#src/app/suite/game-sync.ts'
import { tapWrites } from '#src/app/suite/tapped-store.ts'

// A web game that is linked to a GitHub repository keeps itself there; one that is not never reaches for GitHub.

const session = (): WebGitHubSession => ({
  signedIn: true,
  token: async () => 'ghu_1',
  login: async () => 'me',
  signIn: vi.fn(),
  signOut: async () => undefined,
  subscribe: () => () => undefined,
})
const timers = { after: () => () => undefined, every: () => () => undefined }
const visibility = { isVisible: () => true, onChange: () => () => undefined }

describe('keepOnGitHub', () => {
  it('starts nothing for a game that is not on GitHub, and asks GitHub nothing', () => {
    const fetchFn = vi.fn()
    const sync = keepOnGitHub({
      game: { id: 'lantern-run', title: 'Lantern Run', changed: 1 },
      store: createMemoryStore(),
      session: session(),
      fetch: fetchFn as unknown as typeof fetch,
      timers,
      visibility,
      now: () => 1,
    })
    expect(sync).toBeUndefined()
    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('starts nothing when the site has no sign-in', () => {
    const sync = keepOnGitHub({
      game: { id: 'lantern-run', title: 'Lantern Run', changed: 1, github: 'me/lantern-run' },
      store: createMemoryStore(),
      session: undefined,
      fetch: vi.fn() as unknown as typeof fetch,
      timers,
      visibility,
      now: () => 1,
    })
    expect(sync).toBeUndefined()
  })

  it('starts a sync for a linked game, whose line says it is being checked and then kept', async () => {
    const fetchFn = vi.fn(async () => new Response('{}', { status: 404 }))
    const sync = keepOnGitHub({
      game: { id: 'lantern-run', title: 'Lantern Run', changed: 1, github: 'me/lantern-run' },
      store: createMemoryStore(),
      session: session(),
      fetch: fetchFn as unknown as typeof fetch,
      timers,
      visibility,
      now: () => 1,
    })
    expect(sync).toBeDefined()
    await vi.waitFor(() => expect(fetchFn).toHaveBeenCalled())
    sync?.stop()
  })
})

describe('tapWrites', () => {
  it('tells which file the person’s editors wrote, and nothing for the notes the sync keeps', async () => {
    const told: string[][] = []
    const store = tapWrites(createMemoryStore(), (paths) => told.push([...paths]))
    await store.write('content/feel/feel.toml', 'flash = 1\n')
    await store.write('.automata/sync.json', '{}')
    await store.remove('content/feel/feel.toml')
    expect(told).toEqual([['content/feel/feel.toml'], ['content/feel/feel.toml']])
  })

  it('tells nothing about a write that was refused', async () => {
    const told: string[][] = []
    const store = tapWrites(createMemoryStore(), (paths) => told.push([...paths]))
    await store.write('content/a.toml', 'a = 1\n')
    told.length = 0
    const refused = await store.write('content/a.toml', 'a = 2\n', 'absent')
    expect(refused.ok).toBe(false)
    expect(told).toEqual([])
  })

  it('reads and lists as the store does', async () => {
    const store = tapWrites(createMemoryStore(), () => undefined)
    await store.write('content/a.toml', 'a = 1\n')
    expect((await store.list()).map((entry) => entry.path)).toEqual(['content/a.toml'])
    expect(new TextDecoder().decode(await store.read('content/a.toml'))).toBe('a = 1\n')
  })
})
