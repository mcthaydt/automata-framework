import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { affectedPackages, skipNotice, turboArgs } from '#src/affected-run.ts'

// A pull request runs a task only in the packages its change affects (turbo --affected, dependents included). Turbo
// itself exits 0 and prints almost nothing when no package is left, which reads like a pass; `affected-run-cli` says
// plainly that the step was skipped, and which packages it did run.

const task = (taskId: string, command: string) => ({
  taskId,
  task: taskId.split('#')[1] as string,
  package: taskId.split('#')[0] as string,
  command,
})

describe('affectedPackages', () => {
  it('lists the packages that really run the task, sorted', () => {
    const dry = {
      tasks: [
        task('@automata/site#test:e2e', 'playwright test'),
        task('@af-games/emberwick#test:e2e', 'playwright test'),
        // A dependency's build runs first; it is not a journey.
        task('@automata/tools#build', 'tsdown'),
      ],
    }
    expect(affectedPackages(dry, 'test:e2e')).toEqual(['@af-games/emberwick', '@automata/site'])
  })

  it('leaves out a package that has no script of that name', () => {
    const dry = {
      tasks: [
        task('@automata/evidence#test:unit', '<NONEXISTENT>'),
        task('@automata/sim#test:unit', 'vitest run'),
      ],
    }
    expect(affectedPackages(dry, 'test:unit')).toEqual(['@automata/sim'])
  })

  it('is empty when nothing is affected', () => {
    expect(affectedPackages({ tasks: [] }, 'test:unit')).toEqual([])
  })
})

describe('skipNotice', () => {
  it('says the step was skipped, and why, in words a log reader cannot mistake for a pass', () => {
    expect(skipNotice('test:e2e')).toBe(
      'SKIPPED test:e2e: no package it runs in is affected by this pull request. Nothing was run, so nothing passed.',
    )
  })
})

describe('turboArgs', () => {
  it('asks turbo for the affected packages, keeping the filters and the runner arguments', () => {
    expect(turboArgs('test:e2e', ['--filter', '@automata/site'], [])).toEqual([
      'run',
      'test:e2e',
      '--affected',
      '--filter',
      '@automata/site',
    ])
    expect(turboArgs('test:unit', [], ['--testTimeout=90000'])).toEqual([
      'run',
      'test:unit',
      '--affected',
      '--',
      '--testTimeout=90000',
    ])
  })
})

/**
 * A commit on top of HEAD that changes `file` (a blank line added at its end), made with a scratch index so the work tree
 * is untouched. `git()` trims what it reads, so one newline only restores the file; the second is the change.
 */
function commitChanging(root: string, file: string): string {
  const index = join(mkdtempSync(join(tmpdir(), 'affected-index-')), 'index')
  const env = {
    ...process.env,
    GIT_INDEX_FILE: index,
    GIT_AUTHOR_NAME: 't',
    GIT_AUTHOR_EMAIL: 't@t',
    GIT_COMMITTER_NAME: 't',
    GIT_COMMITTER_EMAIL: 't@t',
  }
  const git = (args: string[], input?: string): string =>
    execFileSync('git', args, { cwd: root, env, input, encoding: 'utf8' }).trim()
  git(['read-tree', 'HEAD'])
  const blob = git(['hash-object', '-w', '--stdin'], `${git(['show', `HEAD:${file}`])}\n\n`)
  git(['update-index', '--cacheinfo', `100644,${blob},${file}`])
  return git(['commit-tree', git(['write-tree']), '-p', 'HEAD', '-m', 'scratch'])
}

describe('affected-run-cli --list', () => {
  // `--list` must run no task. The dry run once passed `--dry=json` after `--`, so turbo handed it to vitest and ran the
  // tests for real.
  it('lists the affected packages and runs nothing, with runner arguments after `--`', () => {
    const root = fileURLToPath(new URL('../../../..', import.meta.url))
    const head = commitChanging(root, 'tooling/repo-hygiene/package.json')
    const done = spawnSync(
      'node',
      ['tooling/repo-hygiene/src/affected-run-cli.ts', '--list', 'test:unit', '--', '--testTimeout=90000'],
      { cwd: root, encoding: 'utf8', env: { ...process.env, TURBO_SCM_BASE: 'HEAD', TURBO_SCM_HEAD: head } },
    )
    expect(done.status, `${done.stdout}${done.stderr}`).toBe(0)
    expect(done.stdout).toContain('affected test:unit: 1 package\n  @automata/repo-hygiene')
    expect(done.stdout).not.toContain('cache miss')
  }, 120_000)

  // The real turbo, on a change that touches nothing: HEAD against HEAD. The step must say it was skipped.
  it('says plainly that nothing ran when no package is affected', () => {
    const root = fileURLToPath(new URL('../../../..', import.meta.url))
    const done = spawnSync(
      'node',
      ['tooling/repo-hygiene/src/affected-run-cli.ts', '--list', 'test:e2e', '--filter', '@automata/site'],
      {
        cwd: root,
        encoding: 'utf8',
        env: { ...process.env, TURBO_SCM_BASE: 'HEAD', TURBO_SCM_HEAD: 'HEAD' },
      },
    )
    expect(done.status, done.stderr).toBe(0)
    expect(done.stdout).toContain(skipNotice('test:e2e'))
  }, 120_000)
})
