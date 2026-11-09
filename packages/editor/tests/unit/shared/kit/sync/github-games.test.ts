import { describe, expect, it } from 'vitest'
import { createMemoryStore } from '#src/shared/kit/storage/memory-store.ts'
import type { ProjectStore } from '#src/shared/kit/storage/project-store.ts'
import {
  getGame,
  installUrl,
  listGitHubGames,
  newRepoUrl,
  repoReachable,
} from '#src/shared/kit/sync/github-games.ts'
import { createFakeGitHubRest } from './fake-github-rest.ts'

// Which of the person's GitHub repositories are Automata games, getting one onto this device, and the two addresses the
// page sends them to (spec 7.3 and 8.2). Everything here talks to a fake GitHub; nothing leaves the test.

const LIST = 'format = "af-editors/1"\n'
const json = (body: unknown, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json', ...headers },
  })

/** GitHub as the page sees it: the app's installations, each with repositories, a few of them games. */
function account(repos: Record<string, boolean>, options: { pages?: boolean } = {}) {
  const asked: string[] = []
  const names = Object.keys(repos)
  const rows = names.map((full) => ({ full_name: full, name: full.split('/')[1], default_branch: 'main' }))
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = new URL(String(input))
    asked.push(`${url.pathname}${url.search}`)
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer ghu_1')
    if (url.pathname === '/user/installations') {
      if (options.pages && url.searchParams.get('page') !== '2')
        return json(
          { installations: [{ id: 1 }] },
          { link: `<https://api.github.com/user/installations?per_page=100&page=2>; rel="next"` },
        )
      return json({ installations: [{ id: options.pages ? 2 : 1 }, ...(options.pages ? [] : [{ id: 2 }])] })
    }
    const mine = /^\/user\/installations\/(\d+)\/repositories$/.exec(url.pathname)
    if (mine !== null) {
      const first = mine[1] === '1'
      return json({ repositories: rows.filter((_, i) => (i % 2 === 0) === first) })
    }
    const content = /^\/repos\/([^/]+\/[^/]+)\/contents\/content\/editors\.toml$/.exec(url.pathname)
    if (content !== null) return new Response('{}', { status: repos[content[1] ?? ''] ? 200 : 404 })
    return new Response('{}', { status: 404 })
  }) as typeof fetch
  return { fetchFn, asked }
}

describe('listGitHubGames', () => {
  it('lists the repositories of every installation that hold a game, and no others', async () => {
    const github = account({ 'me/lantern-run': true, 'me/notes': false, 'club/night-shift': true })
    const found = await listGitHubGames(github.fetchFn, 'ghu_1')
    expect(found).toEqual([
      { repo: 'me/lantern-run', id: 'lantern-run', title: 'lantern-run' },
      { repo: 'club/night-shift', id: 'night-shift', title: 'night-shift' },
    ])
  })

  it('follows the pages GitHub points to', async () => {
    const github = account({ 'me/lantern-run': true, 'club/night-shift': true }, { pages: true })
    const found = await listGitHubGames(github.fetchFn, 'ghu_1')
    expect(found.map((game) => game.repo)).toEqual(['me/lantern-run', 'club/night-shift'])
    expect(github.asked.filter((path) => path.startsWith('/user/installations?'))).toHaveLength(2)
  })

  it('never follows a page that is not on GitHub’s API', async () => {
    let elsewhere = false
    const fetchFn = (async (input: RequestInfo | URL): Promise<Response> => {
      const url = new URL(String(input))
      if (url.origin !== 'https://api.github.com') elsewhere = true
      return json(
        { installations: [] },
        { link: '<https://evil.example/user/installations?page=2>; rel="next"' },
      )
    }) as typeof fetch
    expect(await listGitHubGames(fetchFn, 'ghu_1')).toEqual([])
    expect(elsewhere).toBe(false)
  })

  it('says so when GitHub refuses, rather than showing an empty list', async () => {
    const fetchFn = (async () => new Response('{}', { status: 401 })) as typeof fetch
    await expect(listGitHubGames(fetchFn, 'ghu_1')).rejects.toThrow(/sign in/i)
  })
})

describe('the addresses', () => {
  it('opens a private repository named for the game, and the app’s install page', () => {
    expect(newRepoUrl('lantern-run')).toBe('https://github.com/new?name=lantern-run&visibility=private')
    expect(installUrl('automata')).toBe('https://github.com/apps/automata/installations/new')
  })
})

/** The shelf of games a page keeps, as far as getting a game needs it. */
function shelf() {
  const stores = new Map<string, ProjectStore>()
  const linked = new Map<string, string>()
  return {
    stores,
    linked,
    async create(title: string, files: readonly { path: string; bytes: Uint8Array }[]) {
      const id = title
      const store = createMemoryStore()
      for (const file of files) await store.write(file.path, file.bytes)
      stores.set(id, store)
      return { id, title, changed: 1 }
    },
    async store(id: string): Promise<ProjectStore> {
      const found = stores.get(id)
      if (found === undefined) throw new Error('no such game')
      return found
    },
    async link(id: string, repo: string | undefined): Promise<void> {
      if (repo !== undefined) linked.set(id, repo)
    },
  }
}

describe('getGame', () => {
  it('puts the repository’s files on this device, notes where they came from, and links the game', async () => {
    const github = createFakeGitHubRest({
      repo: 'me/lantern-run',
      files: { 'content/editors.toml': LIST, 'content/feel/feel.toml': 'flash = 3\n' },
    })
    const games = shelf()
    const entry = await getGame(github.fetch, 'ghu_1', 'me/lantern-run', games)
    expect(entry).toMatchObject({ id: 'lantern-run', title: 'lantern-run', github: 'me/lantern-run' })
    const store = await games.store('lantern-run')
    expect(new TextDecoder().decode(await store.read('content/feel/feel.toml'))).toBe('flash = 3\n')
    const note = JSON.parse(new TextDecoder().decode(await store.read('.automata/sync.json'))) as {
      repo: string
      branch: string
      base: { commit: string }
      files: Record<string, string>
    }
    expect(note).toMatchObject({ repo: 'me/lantern-run', branch: 'main', base: { commit: github.head() } })
    expect(Object.keys(note.files).sort()).toEqual(['content/editors.toml', 'content/feel/feel.toml'])
    expect(games.linked.get('lantern-run')).toBe('me/lantern-run')
  })

  it('stops, and makes no game, when the repository is too big to read in one go', async () => {
    const github = createFakeGitHubRest({ repo: 'me/big', files: { 'content/editors.toml': LIST } })
    github.state.truncated = true
    const games = shelf()
    await expect(getGame(github.fetch, 'ghu_1', 'me/big', games)).rejects.toThrow(/too big/i)
    expect(games.stores.size).toBe(0)
  })
})

describe('repoReachable', () => {
  it('is true for a repository the app was let into, empty or not, and false for one it was not', async () => {
    const github = account({ 'me/mine': false })
    expect(await repoReachable(github.fetchFn, 'ghu_1', 'me/mine')).toBe(true)
    expect(await repoReachable(github.fetchFn, 'ghu_1', 'Me/Mine')).toBe(true)
    expect(await repoReachable(github.fetchFn, 'ghu_1', 'me/other')).toBe(false)
  })

  it('is false, not an error, when there is no network', async () => {
    const fetchFn = (async () => {
      throw new TypeError('offline')
    }) as typeof fetch
    expect(await repoReachable(fetchFn, 'ghu_1', 'me/mine')).toBe(false)
  })
})
