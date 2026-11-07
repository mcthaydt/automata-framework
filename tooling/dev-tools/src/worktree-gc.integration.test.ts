import { type ChildProcess, execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { FilesLive, ProcessRunnerLive } from '@mcthaydt/automata-node'
import { Effect, Layer } from 'effect'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { worktreeGc } from './worktree-gc.ts'

// DT-h: real git, lsof and find on a temporary repository with a bare remote and five worktrees: merged and clean
// (the only one to go), uncommitted, ahead of the base, locked, and merged and clean but with a process running in
// it. The report changes nothing; --apply removes only the first, and its branch.

let root = ''
let main = ''
let sleeper: ChildProcess | undefined
const run = (cwd: string, ...args: string[]): string =>
  execFileSync(
    'git',
    ['-c', 'user.name=t', '-c', 'user.email=t@example.com', '-c', 'commit.gpgsign=false', ...args],
    {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  )
const tree = (name: string): string => join(main, '.claude/worktrees', name)
const branches = (): string[] =>
  run(main, 'branch', '--format=%(refname:short)').split('\n').filter(Boolean).sort()

beforeAll(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'dev-tools-gc-int-')))
  main = join(root, 'main')
  run(root, 'init', '-q', '--bare', '-b', 'main', 'remote.git')
  run(root, 'clone', '-q', 'remote.git', 'main')
  writeFileSync(
    join(main, '.gitignore'),
    'test-results/\nplaywright-report/\n.claude/\nnode_modules/\nevidence/\n',
  )
  run(main, 'add', '.gitignore')
  run(main, 'commit', '-q', '-m', 'first')
  run(main, 'push', '-q', 'origin', 'HEAD:main')
  for (const name of ['merged', 'dirty', 'ahead', 'locked', 'busy', 'keepsake'])
    run(main, 'worktree', 'add', '-q', '-b', name, tree(name), 'main')
  mkdirSync(join(tree('merged'), 'test-results'))
  writeFileSync(join(tree('merged'), 'test-results', 'trace.zip'), 'x')
  writeFileSync(join(tree('dirty'), 'notes.txt'), 'unsaved')
  writeFileSync(join(tree('ahead'), 'a.txt'), 'a')
  run(tree('ahead'), 'add', 'a.txt')
  run(tree('ahead'), 'commit', '-q', '-m', 'ahead')
  // Ignored, so `git status --porcelain` hides it, and `git worktree remove` would delete it: evidence that exists
  // nowhere else. node_modules beside it is regenerated and does not hold the worktree.
  mkdirSync(join(tree('keepsake'), 'evidence'))
  writeFileSync(join(tree('keepsake'), 'evidence', 'a.png'), 'png')
  mkdirSync(join(tree('merged'), 'node_modules'))
  writeFileSync(join(tree('merged'), 'node_modules', 'x.js'), 'x')
  run(main, 'worktree', 'lock', tree('locked'))
  sleeper = spawn('sleep', ['120'], { cwd: tree('busy'), stdio: 'ignore' })
})

afterAll(() => {
  sleeper?.kill()
  rmSync(root, { recursive: true, force: true })
})

const gc = (apply: boolean) =>
  Effect.runPromise(
    worktreeGc({ apply, base: 'main', cwd: main }).pipe(
      Effect.provide(Layer.merge(FilesLive, ProcessRunnerLive)),
    ),
  )

describe('DT-h: worktree-gc on a real repository', () => {
  it('reports without changing anything', async () => {
    const out = await gc(false)
    expect(out.exit).toBe(0)
    const decisions = out.stdout.split('\n').filter((line) => /^(keep|remove|scratch) /.test(line))
    // In git's order, which sorts the linked worktrees by path.
    expect(decisions).toEqual([
      'keep     .claude/worktrees/ahead (1 commit not in origin/main)',
      `keep     .claude/worktrees/busy (running process: pid ${sleeper?.pid})`,
      'keep     .claude/worktrees/dirty (1 uncommitted)',
      'keep     .claude/worktrees/keepsake (ignored files git would delete: evidence/)',
      'keep     .claude/worktrees/locked (locked)',
      'scratch  .claude/worktrees/merged/test-results',
      'remove   .claude/worktrees/merged (merged, pushed, clean; branch merged)',
    ])
    expect(out.stdout.trimEnd().split('\n').at(-1)).toBe('(report only: --apply to act)')
    for (const name of ['merged', 'dirty', 'ahead', 'locked', 'busy', 'keepsake'])
      expect(existsSync(tree(name)), name).toBe(true)
    expect(existsSync(join(tree('merged'), 'test-results'))).toBe(true)
  })

  it('removes only the merged, clean, idle worktree and its branch with --apply', async () => {
    const out = await gc(true)
    expect([out.exit, out.stderr]).toEqual([0, ''])
    expect(existsSync(tree('merged'))).toBe(false)
    for (const name of ['dirty', 'ahead', 'locked', 'busy', 'keepsake'])
      expect(existsSync(tree(name)), name).toBe(true)
    expect(existsSync(join(tree('keepsake'), 'evidence', 'a.png'))).toBe(true)
    expect(existsSync(join(tree('dirty'), 'notes.txt'))).toBe(true)
    expect(branches()).toEqual(['ahead', 'busy', 'dirty', 'keepsake', 'locked', 'main'])
  })
})
