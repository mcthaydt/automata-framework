import { describe, expect, it } from 'vitest'
import { createMemoryStore } from '#src/shared/kit/storage/memory-store.ts'
import { OfflineError, SyncStopped } from '#src/shared/kit/sync/git-engine.ts'
import { createRestEngine, type SyncFile } from '#src/shared/kit/sync/rest-engine.ts'
import { startSync } from '#src/shared/kit/sync/sync-loop.ts'
import { createFakeGitHubRest } from '#src/testing/kit/fake-github-rest.ts'
import { FakeTimers, FakeVisibility, settle } from './fake-sync.ts'

// The engine that keeps a game on GitHub through the REST API (spec 8.1), against a repository in memory.

const decoder = new TextDecoder()
const LIST = 'format = "af-editors/1"\n'
const FEEL = '[flash]\nintensity = 1\n\n[shake]\nintensity = 1\n'

async function device(
  github: ReturnType<typeof createFakeGitHubRest>,
  files: Record<string, string> = {},
  now = () => 1000,
) {
  const store = createMemoryStore()
  for (const [path, text] of Object.entries(files)) await store.write(path, text)
  const engine = createRestEngine({
    fetch: github.fetch,
    token: () => Promise.resolve('ghu'),
    store,
    repo: 'me/game',
    now,
  })
  const text = async (path: string) => {
    const bytes = await store.read(path)
    return bytes === undefined ? undefined : decoder.decode(bytes)
  }
  const sync = async () => JSON.parse((await text('.automata/sync.json')) ?? '{}') as SyncFile
  return { store, engine, text, sync }
}

/** A pull: fetch, and merge if there is something. */
async function pull(d: Awaited<ReturnType<typeof device>>) {
  return (await d.engine.fetchMain()) === 'changed' ? d.engine.mergeMain() : undefined
}

describe('pulling', () => {
  it('writes a file that changed only on GitHub, and notes where the two sides agree', async () => {
    const github = createFakeGitHubRest({
      repo: 'me/game',
      files: { [`content/editors.toml`]: LIST, 'content/a.toml': 'a = 1\n' },
    })
    const d = await device(github)
    const out = await pull(d)
    expect([...(out?.changed ?? [])].sort()).toEqual(['content/a.toml', 'content/editors.toml'])
    expect(await d.text('content/a.toml')).toBe('a = 1\n')
    expect((await d.sync()).base?.commit).toBe(github.head())
    expect((await d.sync()).branch).toBe('main')
  })

  it('asks GitHub with If-None-Match, and a 304 is nothing new', async () => {
    const github = createFakeGitHubRest({ repo: 'me/game', files: { 'content/editors.toml': LIST } })
    const d = await device(github)
    await pull(d)
    expect(await d.engine.fetchMain()).toBe('unchanged')
    const refs = github.log.filter((call) => call.path.includes('/git/ref/'))
    expect(refs.at(-1)?.headers.get('if-none-match')).toBe(`"${github.head()}"`)
    expect(github.count('GET', /\/git\/trees\//)).toBe(1)
  })

  it('lands a flash here and a shake there in one file', async () => {
    const github = createFakeGitHubRest({
      repo: 'me/game',
      files: { 'content/editors.toml': LIST, 'content/feel/feel.toml': FEEL },
    })
    const d = await device(github)
    await pull(d)
    await d.store.write('content/feel/feel.toml', '[flash]\nintensity = 2\n\n[shake]\nintensity = 1\n')
    await d.engine.commitAll('Edited in Automata: Feel')
    await github.remoteWrite({
      'content/feel/feel.toml': '[flash]\nintensity = 1\n\n[shake]\nintensity = 3\n',
    })
    const out = await pull(d)
    expect(out?.asks).toEqual([])
    expect(await d.text('content/feel/feel.toml')).toMatch(
      /flash\][\s\S]*intensity = 2[\s\S]*shake\][\s\S]*intensity = 3/,
    )
    expect(await d.engine.push()).toBe('pushed')
    expect(github.file('content/feel/feel.toml')).toMatch(/intensity = 2[\s\S]*intensity = 3/)
  })

  it('asks about a key changed on both sides, and leaves the file here as it was', async () => {
    const github = createFakeGitHubRest({
      repo: 'me/game',
      files: { 'content/editors.toml': LIST, 'content/feel/feel.toml': FEEL },
    })
    const d = await device(github)
    await pull(d)
    const mine = '[flash]\nintensity = 2\n\n[shake]\nintensity = 1\n'
    await d.store.write('content/feel/feel.toml', mine)
    await d.engine.commitAll('Edited in Automata: Feel')
    await github.remoteWrite({
      'content/feel/feel.toml': '[flash]\nintensity = 5\n\n[shake]\nintensity = 1\n',
    })
    const out = await pull(d)
    expect(out?.asks).toHaveLength(1)
    expect(out?.asks[0]).toMatchObject({ path: 'content/feel/feel.toml', reason: 'both-changed' })
    expect(await d.text('content/feel/feel.toml')).toBe(mine)
    // The file that waits for the person is not pushed over GitHub's.
    await d.engine.push()
    expect(github.file('content/feel/feel.toml')).toContain('intensity = 5')
  })

  it('leaves a generated file alone and says GitHub changed it', async () => {
    const list =
      'format = "af-editors/1"\n[[file]]\nglob = "content/levels/*.af2d.json"\neditor = "levels-2d"\nmodes = ["edit"]\nexports = "content/world"\ngates = []\nchecks = []\n'
    const github = createFakeGitHubRest({
      repo: 'me/game',
      files: { 'content/editors.toml': list, 'content/world/project.toml': 'a = 1\n' },
    })
    const d = await device(github)
    await pull(d)
    await github.remoteWrite({ 'content/world/project.toml': 'a = 2\n' })
    const out = await pull(d)
    expect(out?.generated).toEqual(['content/world/project.toml'])
    expect(await d.text('content/world/project.toml')).toBe('a = 1\n')
  })

  it('reads the repository’s own default branch', async () => {
    const github = createFakeGitHubRest({
      repo: 'me/game',
      defaultBranch: 'trunk',
      files: { 'content/editors.toml': LIST },
    })
    const d = await device(github)
    await pull(d)
    expect((await d.sync()).branch).toBe('trunk')
    expect(github.count('GET', '/git/ref/heads/trunk')).toBe(1)
  })

  it('stops with words, not "no internet", for a tree GitHub cut short', async () => {
    const github = createFakeGitHubRest({ repo: 'me/game', files: { 'content/editors.toml': LIST } })
    github.state.truncated = true
    const d = await device(github)
    await expect(pull(d)).rejects.toMatchObject({
      words: 'This game is too big to sync on the web. Use the Automata app.',
    })
    const timers = new FakeTimers()
    const handle = startSync({
      engine: d.engine,
      store: { notifyChanged: () => undefined },
      timers,
      visibility: new FakeVisibility(),
      isSignedIn: () => Promise.resolve(true),
    })
    await settle()
    expect(handle.status.get().line).toBe(
      'Saved on this device. This game is too big to sync on the web. Use the Automata app.',
    )
  })

  it('waits when GitHub asks it to, in words', async () => {
    const github = createFakeGitHubRest({ repo: 'me/game', files: { 'content/editors.toml': LIST } })
    github.state.rateLimited = true
    const d = await device(github, {}, () => 5000)
    const caught = await d.engine.fetchMain().catch((error: unknown) => error)
    expect(caught).toBeInstanceOf(SyncStopped)
    expect(caught).toMatchObject({
      words: 'GitHub asked us to wait. Your game is saved on this device.',
      until: 5000 + 90_000,
    })
  })

  it('is offline, not stopped, when the network is gone', async () => {
    const github = createFakeGitHubRest({ repo: 'me/game', files: { 'content/editors.toml': LIST } })
    github.state.offline = true
    await expect((await device(github)).engine.fetchMain()).rejects.toBeInstanceOf(OfflineError)
  })
})

describe('pushing', () => {
  async function pulled() {
    const github = createFakeGitHubRest({
      repo: 'me/game',
      files: { 'content/editors.toml': LIST, 'content/a.toml': 'a = 1\n', 'content/b.toml': 'b = 1\n' },
    })
    const d = await device(github)
    await pull(d)
    return { github, d }
  }

  it('makes one commit of what changed, with the message it was given', async () => {
    const { github, d } = await pulled()
    await d.store.write('content/a.toml', 'a = 2\n')
    expect(await d.engine.commitAll('Edited in Automata: A')).toBeDefined()
    expect(await d.engine.hasUnpushed()).toBe(true)
    expect(await d.engine.push()).toBe('pushed')
    expect(github.messages().slice(-1)).toEqual(['Edited in Automata: A'])
    expect(github.file('content/a.toml')).toBe('a = 2\n')
    expect(await d.engine.hasUnpushed()).toBe(false)
  })

  it('finds an edit the page closed on before its ten seconds were up, and sends it with a message of its own', async () => {
    const { github, d } = await pulled()
    // The edit was saved on this device and the page went away before anything committed it.
    await d.store.write('content/a.toml', 'a = 3\n')
    expect(await d.engine.hasUnpushed()).toBe(true)
    expect(await d.engine.push()).toBe('pushed')
    expect(github.file('content/a.toml')).toBe('a = 3\n')
    expect(github.messages().slice(-1)).toEqual(['Edited in Automata'])
    expect(await d.engine.hasUnpushed()).toBe(false)
  })

  it('has nothing to commit when nothing changed', async () => {
    const { d } = await pulled()
    expect(await d.engine.commitAll('Edited in Automata: A')).toBeUndefined()
  })

  it('sends a deleted file as sha null in the tree', async () => {
    const { github, d } = await pulled()
    await d.store.remove('content/b.toml')
    await d.engine.commitAll('Edited in Automata: B')
    await d.engine.push()
    const tree = github.log.find((call) => call.method === 'POST' && call.path === '/git/trees')
    expect(JSON.stringify(tree?.body)).toContain(
      '"path":"content/b.toml","mode":"100644","type":"blob","sha":null',
    )
    expect(github.paths()).not.toContain('content/b.toml')
  })

  it('is rejected, never forced, when GitHub moved on, and keeps what waits', async () => {
    const { github, d } = await pulled()
    await d.store.write('content/a.toml', 'a = 2\n')
    await d.engine.commitAll('Edited in Automata: A')
    await github.remoteWrite({ 'content/b.toml': 'b = 9\n' })
    expect(await d.engine.push()).toBe('rejected')
    expect(await d.engine.hasUnpushed()).toBe(true)
    expect(github.file('content/b.toml')).toBe('b = 9\n')
    // After the pull the same commit goes up.
    await pull(d)
    expect(await d.engine.push()).toBe('pushed')
    expect(github.file('content/a.toml')).toBe('a = 2\n')
    expect(github.file('content/b.toml')).toBe('b = 9\n')
  })

  it('is offline when the network goes, keeps what waits, and then makes one commit, not two', async () => {
    const { github, d } = await pulled()
    await d.store.write('content/a.toml', 'a = 2\n')
    await d.engine.commitAll('Edited in Automata: A')
    github.state.offline = true
    expect(await d.engine.push()).toBe('offline')
    expect(await d.engine.hasUnpushed()).toBe(true)
    github.state.offline = false
    expect(await d.engine.push()).toBe('pushed')
    expect(github.messages().filter((message) => message === 'Edited in Automata: A')).toHaveLength(1)
    expect(await d.engine.push()).toBe('pushed')
    expect(github.messages().filter((message) => message === 'Edited in Automata: A')).toHaveLength(1)
  })

  it('never puts the sync note in a tree', async () => {
    const { github, d } = await pulled()
    await d.store.write('content/a.toml', 'a = 2\n')
    await d.engine.commitAll('Edited in Automata: A')
    await d.engine.push()
    expect(github.paths().some((path) => path.startsWith('.automata/'))).toBe(false)
  })
})

describe('an empty repository (Review Focus 4)', () => {
  const FILES = { 'content/editors.toml': LIST, 'content/a.toml': 'a = 1\n' }

  it('has nothing to pull, and that is not "no internet"', async () => {
    const github = createFakeGitHubRest({ repo: 'me/game' })
    const d = await device(github, FILES)
    expect(await d.engine.fetchMain()).toBe('unchanged')
  })

  it('takes the first file through the Contents API, then everything else as one commit on top', async () => {
    const github = createFakeGitHubRest({ repo: 'me/game' })
    const d = await device(github, FILES)
    await d.engine.fetchMain()
    await d.engine.commitAll('Edited in Automata: Editors')
    expect(await d.engine.push()).toBe('pushed')
    expect(github.count('PUT', /\/contents\//)).toBe(1)
    expect(github.log.find((call) => call.method === 'PUT')?.path).toBe('/contents/content/editors.toml')
    expect(github.paths()).toEqual(['content/a.toml', 'content/editors.toml'])
    expect(github.messages()).toEqual(['Edited in Automata: Editors', 'Edited in Automata: Editors'])
    expect(await d.engine.hasUnpushed()).toBe(false)
  })

  it('and the next pull finds nothing new', async () => {
    const github = createFakeGitHubRest({ repo: 'me/game' })
    const d = await device(github, FILES)
    await d.engine.fetchMain()
    await d.engine.commitAll('Edited in Automata: Editors')
    await d.engine.push()
    expect(await d.engine.fetchMain()).toBe('unchanged')
  })
})
