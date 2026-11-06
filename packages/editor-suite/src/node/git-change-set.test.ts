import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { describeChangeSet } from '@mcthaydt/automata-editor-kit/ports/testing'
import { afterAll, describe, expect, test } from 'vitest'
import { createGitChangeSet, type GitChangeSetOptions } from './git-change-set'
import { runArgv } from './run-argv'

const made: string[] = []
afterAll(async () => {
  for (const dir of made) await rm(dir, { recursive: true, force: true })
})

async function git(cwd: string, ...args: string[]): Promise<string> {
  const result = await runArgv(['git', ...args], { cwd })
  if (result.code !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}${result.error ?? ''}`)
  return result.stdout.trim()
}

/** A clean checkout of `main` with one tuning file, cloned from a local bare remote Ship can push to. */
async function project(options: Omit<GitChangeSetOptions, 'root'> = {}) {
  const dir = await mkdtemp(join(tmpdir(), 'af-change-set-'))
  made.push(dir)
  const remote = join(dir, 'remote.git')
  const root = join(dir, 'game')
  await git(dir, 'init', '-q', '--bare', '-b', 'main', remote)
  await git(dir, 'clone', '-q', remote, root)
  await git(root, 'config', 'user.name', 'Editor Test')
  await git(root, 'config', 'user.email', 'editor@example.com')
  // The developer's own signing setup (a hardware key, a signing server) is not under test and can be unreachable.
  await git(root, 'config', 'commit.gpgsign', 'false')
  await git(root, 'switch', '-q', '-c', 'main')
  await mkdir(join(root, 'content'), { recursive: true })
  await writeFile(join(root, 'content/tuning.toml'), 'MAX_MOVE_SPEED = 6.0\n')
  await writeFile(join(root, 'content/notes.md'), 'not part of any change\n')
  await git(root, 'add', '.')
  await git(root, 'commit', '-q', '-m', 'start')
  await git(root, 'push', '-q', '-u', 'origin', 'main')
  const edit = async (path: string, text: string) => {
    await mkdir(dirname(join(root, path)), { recursive: true })
    await writeFile(join(root, path), text)
  }
  return { root, remote, edit, changeSet: createGitChangeSet({ root, gh: false, ...options }) }
}

/** A stand-in for `gh`: no PR for the branch yet, and `pr create` prints a PR address and its argv. */
async function fakeGh(): Promise<string[]> {
  const dir = await mkdtemp(join(tmpdir(), 'af-fake-gh-'))
  made.push(dir)
  const script = join(dir, 'gh.mjs')
  await writeFile(
    script,
    [
      'const [verb, action] = process.argv.slice(2)',
      "if (verb === 'pr' && action === 'view') { console.error('no pull requests found'); process.exit(1) }",
      "if (verb === 'pr' && action === 'create') { console.log('https://github.com/example/game/pull/9'); process.exit(0) }",
      'process.exit(2)',
    ].join('\n'),
  )
  return [process.execPath, script]
}

describeChangeSet('git', () => project())

describe('the git change set', () => {
  test('EDS-j: with gh, Ship opens a draft PR; the pushed branch holds only the recorded file', async () => {
    const { root, remote, edit, changeSet } = await project({ gh: await fakeGh() })
    await changeSet.begin('Faster')
    await edit('content/tuning.toml', 'MAX_MOVE_SPEED = 7.5\n')
    await edit('content/notes.md', 'an edit nobody recorded\n')
    await changeSet.record(['content/tuning.toml'])
    const shipped = await changeSet.ship({ title: 'Tuning: faster', body: 'MAX_MOVE_SPEED 6 to 7.5.' })
    expect(shipped).toMatchObject({
      branch: 'edit/faster',
      pushed: true,
      pr: 'https://github.com/example/game/pull/9',
    })
    expect(await git(remote, 'diff', '--name-only', 'main', 'edit/faster')).toBe('content/tuning.toml')
    expect(await readFile(join(root, 'content/notes.md'), 'utf8')).toBe('an edit nobody recorded\n')
  })

  test('EDS-j: without gh, Ship pushes and gives the compare link with the draft', async () => {
    const { edit, changeSet } = await project({
      gh: ['automata-no-such-gh'],
      webUrl: 'https://github.com/o/game',
    })
    await changeSet.begin('Faster')
    await edit('content/tuning.toml', 'MAX_MOVE_SPEED = 7.5\n')
    await changeSet.record(['content/tuning.toml'])
    const shipped = await changeSet.ship({ title: 'Tuning: faster', body: 'Up.' })
    expect(shipped.pushed).toBe(true)
    expect(shipped.pr).toBeUndefined()
    expect(shipped.compareUrl).toBe(
      'https://github.com/o/game/compare/main...edit/faster?expand=1&title=Tuning%3A%20faster&body=Up.',
    )
  })

  test("a push that fails rejects with git's reason, and the commit stays local", async () => {
    const { root, edit, changeSet } = await project()
    await git(root, 'remote', 'set-url', 'origin', join(root, '..', 'missing.git'))
    await changeSet.begin('Faster')
    await edit('content/tuning.toml', 'MAX_MOVE_SPEED = 7.5\n')
    await changeSet.record(['content/tuning.toml'])
    await expect(changeSet.ship({ title: 'Faster', body: '' })).rejects.toThrow(/push/)
    expect(await git(root, 'log', '-1', '--format=%s')).toBe('Faster')
  })

  test('a file the workspace created is listed as created', async () => {
    const { edit, changeSet } = await project()
    await changeSet.begin('New figure')
    await edit('content/figures/wick.json', '{}\n')
    await changeSet.noteCreated('content/figures/wick.json')
    await changeSet.record(['content/figures/wick.json'])
    expect((await changeSet.list())[0]).toMatchObject({
      files: ['content/figures/wick.json'],
      created: ['content/figures/wick.json'],
    })
  })

  test('the journal lives in the git directory: the work tree stays clean of it', async () => {
    const { root, changeSet } = await project()
    await changeSet.begin('Faster')
    await changeSet.spend(10)
    expect(await git(root, 'status', '--porcelain')).toBe('')
  })

  test('a second adapter on the same checkout sees the same change set and tokens', async () => {
    const { root, changeSet } = await project()
    await changeSet.begin('Faster')
    await changeSet.spend(120)
    const other = createGitChangeSet({ root, gh: false })
    expect((await other.current())?.title).toBe('Faster')
    expect((await other.list())[0]?.tokens.used).toBe(120)
  })

  test('the compare link comes from an ssh GitHub remote when no web address is given', async () => {
    const { root, changeSet } = await project()
    await changeSet.begin('Faster')
    await git(root, 'remote', 'set-url', 'origin', 'git@github.com:owner/game.git')
    await git(root, 'remote', 'set-url', '--push', 'origin', join(root, '..', 'remote.git'))
    const shipped = await changeSet.ship({ title: 'Faster', body: '' })
    expect(shipped.compareUrl.startsWith('https://github.com/owner/game/compare/main...edit/faster?')).toBe(
      true,
    )
  })
})
