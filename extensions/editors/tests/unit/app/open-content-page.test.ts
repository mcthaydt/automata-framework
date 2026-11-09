import { createFakeOpfs } from '@automata/editor/kit/testing'
import { openWebGames } from '@automata/editor/web-games'
import { describe, expect, it } from 'vitest'
import { openContentPage } from '#src/app/suite/open-content-page.ts'

// The page with every editor decides what to show: a game served by `automata editor`, or the person's own games in
// this browser (the one open last, the list of them, or a new one), or the sample when asked for.

const json = (body: unknown): Response =>
  new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })

const LIST = 'format = "af-editors/1"\n'

function env(options: { served?: boolean; search?: string; opfs?: ReturnType<typeof createFakeOpfs> } = {}) {
  const opfs = options.opfs ?? createFakeOpfs()
  const fetchFn = (async (input: RequestInfo | URL) => {
    const url = new URL(String(input))
    if (options.served !== true) throw new TypeError('Failed to fetch')
    if (url.pathname === '/api/ping') return json({ automata: 'editor', token: false, game: 'Yard' })
    if (url.pathname === '/api/list')
      return json([{ path: 'content/editors.toml', mtime: 1, size: LIST.length }])
    return new Response(LIST)
  }) as typeof fetch
  return {
    origin: 'http://127.0.0.1:4173',
    search: options.search ?? '',
    fetch: fetchFn,
    storage: { getDirectory: () => Promise.resolve(opfs) },
    now: () => 1000,
    opfs,
  }
}

async function withGame(title = 'Lantern Run') {
  const base = env()
  const games = await openWebGames(base)
  const made = await games.create(title, [{ path: 'content/editors.toml', text: LIST }])
  return { base, games, made }
}

describe('openContentPage', () => {
  it('on a page served by automata editor shows the checkout, and ignores the person’s games', async () => {
    const { base } = await withGame()
    const page = await openContentPage(env({ served: true, opfs: base.opfs }))
    expect(page.kind).toBe('checkout')
  })

  it('with no games asks which to make or open', async () => {
    expect((await openContentPage(env())).kind).toBe('games')
  })

  it('opens the game open last, and the editor with it', async () => {
    const { base, games, made } = await withGame()
    await games.remember(made.id, 'writer')
    const page = await openContentPage(base)
    expect(page).toMatchObject({ kind: 'game', game: { id: 'lantern-run' }, editor: 'writer' })
    if (page.kind === 'game') {
      expect(page.opened.sample).toBe(false)
      expect(page.opened.game).toBe('Lantern Run')
      expect(page.opened.where).toBe('device')
    }
  })

  it('tells the page which files the editors changed, and gives it the game’s own files to sync into', async () => {
    const base = env()
    const games = await openWebGames(base)
    const list = `${LIST}[[file]]\nglob = "content/feel/feel.toml"\neditor = "feel"\nmodes = ["edit"]\ngates = []\nchecks = []\n`
    const made = await games.create('Lantern Run', [{ path: 'content/editors.toml', text: list }])
    const told: string[][] = []
    const page = await openContentPage({
      ...base,
      search: `?game=${made.id}`,
      onEdit: (paths) => told.push([...paths]),
    })
    if (page.kind !== 'game') throw new Error('expected a game')
    // The person's editors write through the ports; a pull writes to the game's own files.
    expect(
      await page.opened.ports.workspace.write('content/feel/feel.toml', 'flash = 1\n', 'absent'),
    ).toMatchObject({
      ok: true,
    })
    await page.store.write('content/feel/feel.toml', 'flash = 2\n')
    expect(told).toEqual([['content/feel/feel.toml']])
  })

  it('opens the game ?game= names, and asks which when it names none that exists', async () => {
    const { base, made } = await withGame()
    expect((await openContentPage({ ...base, search: `?game=${made.id}` })).kind).toBe('game')
    expect((await openContentPage({ ...base, search: '?game=nope' })).kind).toBe('games')
  })

  it('?games shows the list even when a game was open last', async () => {
    const { base, games, made } = await withGame()
    await games.remember(made.id)
    expect((await openContentPage({ ...base, search: '?games' })).kind).toBe('games')
  })

  it('?new=2d asks for a name for a new game of that kind', async () => {
    expect(await openContentPage(env({ search: '?new=2d' }))).toMatchObject({
      kind: 'new',
      startingPoint: '2d',
    })
  })

  it('?sample opens the sample and leaves its folder alone', async () => {
    const page = await openContentPage(env({ search: '?sample' }))
    expect(page.kind).toBe('sample')
    if (page.kind === 'sample') expect(page.opened.sample).toBe(true)
  })

  it('tells the page the browser keeps nothing', async () => {
    const page = await openContentPage({ ...env({ search: '?new=2d' }), storage: {} })
    expect(page.kind).toBe('new')
    if (page.kind === 'new') expect(page.games.kept).toBe(false)
  })
})
