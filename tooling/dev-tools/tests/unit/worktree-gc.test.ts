import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect, Layer } from 'effect'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { FilesLive } from '#src/node-seams.ts'
import { type FakeAnswer, fakeProcessRunner, type RunCall } from '#src/testing/fake-process-runner.ts'
import { worktreeGc } from '#src/worktree-gc.ts'

// DT-e, DT-f and DT-g: git and lsof are answered by a fake; the worktree folders are real (temporary), so scratch
// removal is observable on disk. Every refusal has its own case.

interface Tree {
  readonly name: string
  readonly branch?: string | null
  readonly locked?: boolean
  readonly prunable?: boolean
  readonly dirty?: string
  readonly notInBase?: number
  readonly onNoRemote?: number
  readonly statusFails?: boolean
  /** `git status --porcelain --ignored` lines for ignored paths, without the `!! ` prefix. */
  readonly ignored?: readonly string[]
}

interface Repo {
  readonly trees: readonly Tree[]
  readonly here?: string
  readonly fetchFails?: boolean
  /** Working folders of running processes, relative to main; `'not-found'` when lsof is missing. */
  readonly processes?: ReadonlyArray<{ pid: number; at: string }> | 'not-found'
  readonly orphans?: readonly string[]
  readonly removeFails?: string
  /** The --base option (default main). */
  readonly base?: string
}

let main = ''
beforeEach(() => {
  main = mkdtempSync(join(tmpdir(), 'dev-tools-gc-'))
})
afterEach(() => rmSync(main, { recursive: true, force: true }))

const at = (name: string): string => (name === '.' ? main : join(main, '.claude/worktrees', name))

function answer(repo: Repo, call: RunCall): FakeAnswer {
  if (call.command === 'lsof') {
    if (repo.processes === 'not-found') return 'not-found'
    return {
      stdout: (repo.processes ?? []).flatMap(({ pid, at: dir }) => [`p${pid}`, `n${at(dir)}`]).join('\n'),
    }
  }
  if (call.command === 'find') return { stdout: (repo.orphans ?? []).map((name) => `${at(name)}\n`).join('') }
  const [flag, dir, ...rest] = call.args
  if (call.command !== 'git' || flag !== '-C' || dir === undefined)
    throw new Error(`unexpected ${call.command}`)
  const command = rest.join(' ')
  const tree = repo.trees.find((t) => at(t.name) === dir)
  if (command === 'rev-parse --show-toplevel') return { stdout: `${at(repo.here ?? '.')}\n` }
  if (command === 'worktree list --porcelain')
    return {
      stdout: [{ name: '.', branch: 'main' } as Tree, ...repo.trees]
        .map((t) =>
          [
            `worktree ${at(t.name)}`,
            'HEAD 0123456789012345678901234567890123456789',
            t.branch === null ? 'detached' : `branch refs/heads/${t.branch ?? t.name}`,
            ...(t.locked ? ['locked'] : []),
            ...(t.prunable ? ['prunable gitdir file points to non-existent location'] : []),
            '',
          ].join('\n'),
        )
        .join('\n'),
    }
  const base = repo.base ?? 'main'
  if (command === `fetch -q origin ${base}`)
    return repo.fetchFails ? { exitCode: 128, stderr: 'no origin' } : {}
  if (command === 'worktree prune --dry-run -v')
    return { stdout: 'Removing worktrees/gone: gitdir file points to non-existent location\n' }
  if (command === 'status --porcelain --ignored')
    return tree?.statusFails
      ? { exitCode: 128, stderr: 'fatal: broken' }
      : { stdout: `${tree?.dirty ?? ''}${(tree?.ignored ?? []).map((path) => `!! ${path}\n`).join('')}` }
  // Exactly the base the command must compare with: origin/<base> after a fetch, else the local <base>.
  if (command === `rev-list --count ${repo.fetchFails ? base : `origin/${base}`}..HEAD`)
    return { stdout: `${tree?.notInBase ?? 0}\n` }
  if (command === 'rev-list --count HEAD --not --remotes') return { stdout: `${tree?.onNoRemote ?? 0}\n` }
  if (command.startsWith('worktree remove ') && repo.removeFails)
    return { exitCode: 128, stderr: `${repo.removeFails}\n` }
  if (
    command.startsWith('worktree remove ') ||
    command.startsWith('branch -d ') ||
    command === 'worktree prune'
  )
    return {}
  throw new Error(`unexpected git ${command}`)
}

function gc(repo: Repo, apply = false) {
  for (const tree of repo.trees) if (!tree.prunable) mkdirSync(at(tree.name), { recursive: true })
  const fake = fakeProcessRunner((call) => answer(repo, call))
  const output = Effect.runSync(
    worktreeGc({ apply, base: repo.base ?? 'main', cwd: main }).pipe(
      Effect.provide(Layer.merge(FilesLive, fake.layer)),
    ),
  )
  const mutations = fake
    .lines()
    .filter((line) => / worktree remove | branch -d | worktree prune$/.test(line))
    .map((line) => line.replace(`git -C ${main} `, '').replace(main, '<main>'))
  return { ...output, lines: output.stdout.trimEnd().split('\n'), mutations }
}

const linesFor = (lines: readonly string[], word: string): string[] =>
  lines.filter((line) => line.startsWith(word))

describe('DT-e: a report by default', () => {
  it('reports the base, the prune and each decision, and changes nothing', () => {
    mkdirSync(join(at('merged'), 'test-results'), { recursive: true })
    const out = gc({ trees: [{ name: 'merged' }] })
    expect(out.exit).toBe(0)
    expect(out.lines).toEqual([
      'base: origin/main',
      'Removing worktrees/gone: gitdir file points to non-existent location',
      'scratch  .claude/worktrees/merged/test-results',
      'remove   .claude/worktrees/merged (merged, pushed, clean; branch merged)',
      '(report only: --apply to act)',
    ])
    expect(out.mutations).toEqual([])
    expect(existsSync(join(at('merged'), 'test-results'))).toBe(true)
  })
})

describe('DT-f: never removes', () => {
  const keepLine = (tree: Tree, repo: Partial<Repo> = {}): string[] => {
    const out = gc({ trees: [tree], ...repo }, true)
    expect(out.mutations.filter((line) => line.startsWith('worktree remove'))).toEqual([])
    return linesFor(out.lines, 'keep')
  }

  it('a locked worktree', () => {
    expect(keepLine({ name: 'a', locked: true })).toEqual(['keep     .claude/worktrees/a (locked)'])
  })

  it('a worktree with a running process in it or below it', () => {
    expect(keepLine({ name: 'a' }, { processes: [{ pid: 42, at: 'a/packages/x' }] })).toEqual([
      'keep     .claude/worktrees/a (running process: pid 42)',
    ])
  })

  it('any worktree when running processes cannot be checked', () => {
    expect(keepLine({ name: 'a' }, { processes: 'not-found' })).toEqual([
      'keep     .claude/worktrees/a (cannot check for running processes: lsof could not be started)',
    ])
  })

  it('a worktree with uncommitted changes, untracked files included', () => {
    expect(keepLine({ name: 'a', dirty: ' M a.ts\n?? b.ts\n' })).toEqual([
      'keep     .claude/worktrees/a (2 uncommitted)',
    ])
  })

  it('a worktree with commits not in the base', () => {
    expect(keepLine({ name: 'a', notInBase: 3 })).toEqual([
      'keep     .claude/worktrees/a (3 commits not in origin/main)',
    ])
  })

  it('a worktree with commits on no remote', () => {
    expect(keepLine({ name: 'a', onNoRemote: 1 })).toEqual([
      'keep     .claude/worktrees/a (1 commit on no remote)',
    ])
  })

  it('a worktree with ignored files outside the regenerated folders, naming them', () => {
    expect(
      keepLine({
        name: 'a',
        ignored: [
          '.env',
          'evidence/',
          'node_modules/',
          'packages/x/node_modules/',
          'packages/x/dist/',
          '.turbo/',
        ],
      }),
    ).toEqual(['keep     .claude/worktrees/a (ignored files git would delete: .env, evidence/)'])
  })

  it('removes a worktree whose only ignored files are regenerated ones', () => {
    const out = gc(
      {
        trees: [
          {
            name: 'a',
            ignored: [
              'node_modules/',
              '.core/',
              'dist/',
              'packages/x/.turbo/',
              'test-results/',
              '.evidence/',
            ],
          },
        ],
      },
      true,
    )
    expect(out.mutations).toContain(`worktree remove <main>/.claude/worktrees/a`)
  })

  it('a worktree whose git check fails', () => {
    expect(keepLine({ name: 'a', statusFails: true })).toEqual([
      'keep     .claude/worktrees/a (git status failed: fatal: broken)',
    ])
  })

  it('the checkout it runs from', () => {
    expect(keepLine({ name: 'a' }, { here: 'a' })).toEqual(['keep     .claude/worktrees/a (this checkout)'])
  })

  it('the main checkout, which it does not list at all', () => {
    const out = gc({ trees: [] }, true)
    expect(out.lines.filter((line) => line.includes(main) || /^(keep|remove) /.test(line))).toEqual([])
    expect(out.mutations).toEqual(['worktree prune'])
  })
})

describe('DT-g: --apply', () => {
  it('removes only the merged, pushed, clean, idle worktree, without --force, then its branch with -d', () => {
    const out = gc(
      {
        trees: [
          { name: 'merged', branch: 'feature/merged' },
          { name: 'dirty', dirty: '?? x\n' },
          { name: 'ahead', notInBase: 1 },
        ],
      },
      true,
    )
    expect(out.exit).toBe(0)
    expect(out.mutations).toEqual([
      'worktree prune',
      `worktree remove <main>/.claude/worktrees/merged`,
      'branch -d feature/merged',
    ])
    expect(out.lines.at(-1)).not.toBe('(report only: --apply to act)')
  })

  it('removes a detached merged worktree without touching any branch', () => {
    const out = gc({ trees: [{ name: 'd', branch: null }] }, true)
    expect(out.mutations).toEqual(['worktree prune', `worktree remove <main>/.claude/worktrees/d`])
    expect(linesFor(out.lines, 'remove')).toEqual(['remove   .claude/worktrees/d (merged, pushed, clean)'])
  })

  it('clears scratch, but not in a locked worktree or one with a running process', () => {
    for (const name of ['free', 'locked', 'busy'])
      for (const folder of ['playwright-report', 'test-results'])
        mkdirSync(join(at(name), folder), { recursive: true })
    const out = gc(
      {
        trees: [{ name: 'free', dirty: ' M a\n' }, { name: 'locked', locked: true }, { name: 'busy' }],
        processes: [{ pid: 7, at: 'busy' }],
      },
      true,
    )
    expect(linesFor(out.lines, 'scratch')).toEqual([
      'scratch  .claude/worktrees/free/playwright-report',
      'scratch  .claude/worktrees/free/test-results',
      'scratch  .claude/worktrees/locked/playwright-report (locked: left)',
      'scratch  .claude/worktrees/locked/test-results (locked: left)',
      'scratch  .claude/worktrees/busy/playwright-report (running process: left)',
      'scratch  .claude/worktrees/busy/test-results (running process: left)',
    ])
    expect(existsSync(join(at('free'), 'test-results'))).toBe(false)
    expect(existsSync(join(at('free'), 'playwright-report'))).toBe(false)
    expect(existsSync(join(at('locked'), 'test-results'))).toBe(true)
    expect(existsSync(join(at('busy'), 'test-results'))).toBe(true)
  })

  it('reports an orphan folder and never removes it', () => {
    mkdirSync(at('stray'), { recursive: true })
    const out = gc({ trees: [], orphans: ['stray'] }, true)
    expect(linesFor(out.lines, 'orphan')).toEqual([
      'orphan   .claude/worktrees/stray (not a worktree git knows; left for a person)',
    ])
    expect(existsSync(at('stray'))).toBe(true)
  })

  it('skips a prunable record (its folder is gone)', () => {
    const out = gc({ trees: [{ name: 'gone', prunable: true }] }, true)
    expect(out.mutations).toEqual(['worktree prune'])
  })

  it('compares with origin/<base> for a configured --base', () => {
    const out = gc({ trees: [{ name: 'a', notInBase: 1 }], base: 'develop' })
    expect(out.lines[0]).toBe('base: origin/develop')
    expect(linesFor(out.lines, 'keep')).toEqual([
      'keep     .claude/worktrees/a (1 commit not in origin/develop)',
    ])
  })

  it('uses the local base when the fetch fails', () => {
    const out = gc({ trees: [{ name: 'a', notInBase: 2 }], fetchFails: true })
    expect(out.lines[0]).toBe('base: main (fetch from origin failed)')
    expect(linesFor(out.lines, 'keep')).toEqual(['keep     .claude/worktrees/a (2 commits not in main)'])
  })

  it('reports a removal git refuses and exits 1', () => {
    const out = gc({ trees: [{ name: 'a' }], removeFails: 'fatal: contains modified files' }, true)
    expect(out.exit).toBe(1)
    expect(linesFor(out.lines, 'failed')).toEqual([
      'failed   .claude/worktrees/a: fatal: contains modified files',
    ])
    expect(out.mutations.filter((line) => line.startsWith('branch -d'))).toEqual([])
  })
})
