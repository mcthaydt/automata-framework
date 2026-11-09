import fs, { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import http from 'isomorphic-git/http/node'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createGitEngine, type GitEngineApi } from '#src/shared/kit/sync/create-git-engine.ts'
import { OfflineError } from '#src/shared/kit/sync/git-engine.ts'
import { type GitServer, startGitServer } from './git-server.ts'

const FEEL = [
  '# How long the screen flashes.',
  'flash = 0.2',
  '',
  'a = 1',
  'b = 2',
  'c = 3',
  '',
  '# Shake.',
  'shake = 0.5',
  '',
].join('\n')
const EDITORS =
  'format = "af-editors/1"\n\n[[file]]\nglob = "content/levels/*.af2d.json"\neditor = "levels-2d"\nmodes = ["edit"]\nexports = "content"\ngates = []\nchecks = ["content"]\n'
const START = {
  'content/feel.toml': FEEL,
  'content/editors.toml': EDITORS,
  'content/levels/start.toml': 'id = "start"\nx = 1\n',
  'content/levels/start.af2d.json': '{\n  "x": 1\n}\n',
}

let server: GitServer
let folders: string[]

beforeEach(async () => {
  server = await startGitServer(START)
  folders = []
})
afterEach(async () => {
  await server.stop()
  for (const folder of folders) rmSync(folder, { recursive: true, force: true })
})

/** A clone of the game in a fresh folder, with the engine over it. */
async function open(): Promise<{ dir: string; engine: GitEngineApi }> {
  const dir = mkdtempSync(join(tmpdir(), 'af-git-clone-'))
  folders.push(dir)
  const engine = createGitEngine({ fs, http, dir, author: { name: 'Dana', email: 'dana@example.com' } })
  await engine.clone(server.url)
  return { dir, engine }
}

const write = (dir: string, path: string, text: string): void => {
  mkdirSync(dirname(join(dir, path)), { recursive: true })
  writeFileSync(join(dir, path), text)
}
const read = (dir: string, path: string): string => readFileSync(join(dir, path), 'utf8')
const remote = (...args: string[]): string => server.git(...args)

describe('the git engine over a real repository served over HTTP', () => {
  it('clones the game', async () => {
    const { dir } = await open()
    expect(read(dir, 'content/feel.toml')).toBe(FEEL)
  })

  it('commits what changed as one commit and pushes it, and the server’s main has it', async () => {
    const { dir, engine } = await open()
    write(dir, 'content/feel.toml', FEEL.replace('flash = 0.2', 'flash = 0.4'))
    expect(await engine.hasUnpushed()).toBe(false)
    const sha = await engine.commitAll('Edited in Automata: Feel')
    expect(sha).toMatch(/^[0-9a-f]{40}$/)
    expect(await engine.hasUnpushed()).toBe(true)
    expect(await engine.push()).toBe('pushed')
    expect(await engine.hasUnpushed()).toBe(false)
    expect(remote('log', '-1', '--format=%s', 'main')).toBe('Edited in Automata: Feel')
    expect(remote('show', 'main:content/feel.toml')).toContain('flash = 0.4')
  })

  it('makes no commit when nothing changed', async () => {
    const { engine } = await open()
    expect(await engine.commitAll('Nothing')).toBeUndefined()
  })

  it('says there is nothing new until someone else pushes, then merges both edits', async () => {
    const mine = await open()
    const theirs = await open()
    expect(await mine.engine.fetchMain()).toBe('unchanged')

    write(theirs.dir, 'content/feel.toml', FEEL.replace('shake = 0.5', 'shake = 0.9'))
    await theirs.engine.commitAll('Claude: harder shake')
    expect(await theirs.engine.push()).toBe('pushed')

    write(mine.dir, 'content/feel.toml', FEEL.replace('flash = 0.2', 'flash = 0.4'))
    await mine.engine.commitAll('Edited in Automata: Feel')
    expect(await mine.engine.fetchMain()).toBe('changed')
    const outcome = await mine.engine.mergeMain()
    expect(outcome.asks).toEqual([])
    expect(outcome.changed).toEqual(['content/feel.toml'])
    expect(read(mine.dir, 'content/feel.toml')).toBe(
      FEEL.replace('flash = 0.2', 'flash = 0.4').replace('shake = 0.5', 'shake = 0.9'),
    )
    expect(await mine.engine.push()).toBe('pushed')
    expect(remote('rev-list', '--parents', '-1', 'main').split(' ')).toHaveLength(3)
  })

  it('brings in a change when nothing was edited here', async () => {
    const mine = await open()
    const theirs = await open()
    write(theirs.dir, 'content/new.toml', 'a = 1\n')
    await theirs.engine.commitAll('Claude: new file')
    await theirs.engine.push()
    await mine.engine.fetchMain()
    expect((await mine.engine.mergeMain()).changed).toEqual(['content/new.toml'])
    expect(read(mine.dir, 'content/new.toml')).toBe('a = 1\n')
  })

  it('asks, and leaves every file as it was, when the same key changed on both sides', async () => {
    const mine = await open()
    const theirs = await open()
    write(theirs.dir, 'content/feel.toml', FEEL.replace('flash = 0.2', 'flash = 0.9'))
    await theirs.engine.commitAll('Claude: flash')
    await theirs.engine.push()
    const edited = FEEL.replace('flash = 0.2', 'flash = 0.4')
    write(mine.dir, 'content/feel.toml', edited)
    await mine.engine.commitAll('Edited in Automata: Feel')
    await mine.engine.fetchMain()
    const outcome = await mine.engine.mergeMain()
    expect(outcome.asks).toEqual([{ path: 'content/feel.toml', reason: 'both-changed', where: 'flash' }])
    expect(outcome.changed).toEqual([])
    expect(read(mine.dir, 'content/feel.toml')).toBe(edited)
    expect(read(mine.dir, 'content/feel.toml')).not.toContain('<<<<')
  })

  it('names a level’s TOML edited on GitHub as generated and keeps the game’s own', async () => {
    const mine = await open()
    const theirs = await open()
    write(theirs.dir, 'content/levels/start.toml', 'id = "start"\nx = 99\n')
    await theirs.engine.commitAll('Claude: moved start')
    await theirs.engine.push()
    await mine.engine.fetchMain()
    const outcome = await mine.engine.mergeMain()
    expect(outcome.generated).toEqual(['content/levels/start.toml'])
    expect(outcome.changed).not.toContain('content/levels/start.toml')
    expect(read(mine.dir, 'content/levels/start.toml')).toBe('id = "start"\nx = 1\n')
  })

  it('never forces: a push GitHub has moved past is rejected and changes nothing there', async () => {
    const mine = await open()
    const theirs = await open()
    write(theirs.dir, 'content/other.toml', 'a = 1\n')
    await theirs.engine.commitAll('Claude: other')
    await theirs.engine.push()
    const before = remote('rev-parse', 'main')
    write(mine.dir, 'content/feel.toml', FEEL.replace('flash = 0.2', 'flash = 0.4'))
    await mine.engine.commitAll('Edited in Automata: Feel')
    expect(await mine.engine.push()).toBe('rejected')
    expect(remote('rev-parse', 'main')).toBe(before)
  })

  it('exports a branch’s files into a folder without moving HEAD', async () => {
    const mine = await open()
    const theirs = await open()
    await theirs.engine.checkoutNewBranch('claude/more-shake')
    write(theirs.dir, 'content/feel.toml', FEEL.replace('shake = 0.5', 'shake = 2'))
    await theirs.engine.commitAll('Claude: shake')
    await theirs.engine.pushBranch('claude/more-shake')
    const head = await mine.engine.head()
    await mine.engine.fetchBranch('claude/more-shake')
    const out = mkdtempSync(join(tmpdir(), 'af-git-export-'))
    folders.push(out)
    await mine.engine.exportTree('claude/more-shake', out)
    expect(readFileSync(join(out, 'content/feel.toml'), 'utf8')).toContain('shake = 2')
    expect(await mine.engine.head()).toBe(head)
    expect(read(mine.dir, 'content/feel.toml')).toBe(FEEL)
  })

  it('reverts a merge with a new commit, keeping later edits elsewhere', async () => {
    const mine = await open()
    const theirs = await open()
    write(theirs.dir, 'content/feel.toml', FEEL.replace('shake = 0.5', 'shake = 0.9'))
    await theirs.engine.commitAll('Claude: shake')
    await theirs.engine.push()
    write(mine.dir, 'content/feel.toml', FEEL.replace('flash = 0.2', 'flash = 0.4'))
    await mine.engine.commitAll('Edited in Automata: Feel')
    await mine.engine.fetchMain()
    await mine.engine.mergeMain()
    const merge = await mine.engine.head()
    write(mine.dir, 'content/later.toml', 'z = 1\n')
    await mine.engine.commitAll('Edited in Automata: Later')
    const reverted = await mine.engine.revertMerge(merge, 'Not this one')
    expect(reverted).toMatch(/^[0-9a-f]{40}$/)
    expect(read(mine.dir, 'content/feel.toml')).toBe(FEEL.replace('flash = 0.2', 'flash = 0.4'))
    expect(read(mine.dir, 'content/later.toml')).toBe('z = 1\n')
    expect(await mine.engine.head()).toBe(reverted)
  })

  it('says offline, not failed, when GitHub cannot be reached', async () => {
    const { dir, engine } = await open()
    write(dir, 'content/feel.toml', 'a = 1\n')
    await engine.commitAll('Edited')
    await server.stop()
    await expect(engine.fetchMain()).rejects.toBeInstanceOf(OfflineError)
    expect(await engine.push()).toBe('offline')
    expect(await engine.hasUnpushed()).toBe(true)
  })
})
