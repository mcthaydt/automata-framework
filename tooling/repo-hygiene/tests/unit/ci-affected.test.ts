import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'
import { parse } from 'yaml'

// Owner, 2026-11-13: "we should only run tests that are relevant to the pr". On a pull request the unit tests and the
// journeys run for the packages the change affects (turbo --affected); the push to main, the nightly run and a manual
// run keep running everything. Turbo's package graph cannot see a file outside a workspace folder (root config, the
// lockfile, a workflow, vendor/, most docs), so the `scope` step names those and the pull request then runs everything.
// These tests run the real `scope` step on real merge commits and read the real workflow, so a drifting regex or a
// step whose condition lost its pull-request guard fails here.

const root = fileURLToPath(new URL('../../../..', import.meta.url))
const workflow = parse(readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8')) as {
  jobs: Record<
    string,
    {
      env?: Record<string, string>
      steps: { id?: string; name?: string; if?: string; run?: string; env?: Record<string, string> }[]
    }
  >
}
const checks = workflow.jobs.checks
const e2e = workflow.jobs['e2e-2d']

const scopeStep = checks?.steps.find((step) => step.id === 'scope')
const scopeScript = scopeStep?.run ?? ''

const scratch = mkdtempSync(join(tmpdir(), 'ci-scope-'))
afterAll(() => rmSync(scratch, { recursive: true, force: true }))

function git(cwd: string, ...args: string[]): string {
  return execFileSync('git', args, {
    cwd,
    encoding: 'utf8',
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 't',
      GIT_AUTHOR_EMAIL: 't@t',
      GIT_COMMITTER_NAME: 't',
      GIT_COMMITTER_EMAIL: 't@t',
    },
  })
}

function write(cwd: string, file: string, text: string): void {
  mkdirSync(dirname(join(cwd, file)), { recursive: true })
  writeFileSync(join(cwd, file), text)
}

let counter = 0

/**
 * What the `scope` step prints for a pull request that changes `files`: a repository with a base commit, a branch that
 * touches the files, and the merge commit GitHub checks out (its first parent is the base tip). `noMerge` runs the
 * step on the branch tip alone, where there is no way to tell what the pull request changed.
 */
function scope(files: readonly string[], options: { noMerge?: boolean } = {}): Record<string, string> {
  const repo = join(scratch, `repo-${++counter}`)
  mkdirSync(repo)
  git(repo, 'init', '-q', '-b', 'main')
  write(repo, 'README.md', 'base\n')
  write(repo, 'packages/sim/src/a.ts', 'base\n')
  write(repo, 'pnpm-lock.yaml', 'base\n')
  git(repo, 'add', '-A')
  git(repo, 'commit', '-q', '-m', 'base')
  git(repo, 'checkout', '-q', '-b', 'pr')
  for (const file of files) write(repo, file, `changed ${counter}\n`)
  git(repo, 'add', '-A')
  git(repo, 'commit', '-q', '-m', 'change')
  if (options.noMerge !== true) {
    git(repo, 'checkout', '-q', 'main')
    // A commit on main as well, so the merge is a true merge commit with two parents, as GitHub's is.
    write(repo, 'unrelated-on-main.txt', 'x\n')
    git(repo, 'add', '-A')
    git(repo, 'commit', '-q', '-m', 'main moves')
    git(repo, 'checkout', '-q', '-b', 'merge')
    git(repo, 'merge', '-q', '--no-ff', '-m', 'merge', 'pr')
  }
  const out = join(repo, 'github-output.txt')
  writeFileSync(out, '')
  const done = spawnSync('bash', ['-e', '-c', scopeScript], {
    cwd: repo,
    encoding: 'utf8',
    env: { ...process.env, GITHUB_OUTPUT: out },
  })
  expect(done.status, done.stderr).toBe(0)
  return Object.fromEntries(
    readFileSync(out, 'utf8')
      .split('\n')
      .filter((line) => line.includes('='))
      .map((line) => [line.slice(0, line.indexOf('=')), line.slice(line.indexOf('=') + 1)]),
  )
}

describe('the scope step names what only an affected-only run could miss', () => {
  it('exists', () => {
    expect(scopeScript).not.toBe('')
  })

  // A change turbo can place in a package runs that package's tests and its dependents' (--affected).
  it.each([
    ['a package', ['packages/sim/src/a.ts']],
    ['a game', ['games/emberwick/src/a.ts']],
    ['an example', ['examples/2d/a.ts']],
    ['an extension', ['extensions/figures/src/a.ts']],
    ['a tooling package', ['tooling/repo-hygiene/src/a.ts']],
    ['the website, which is a workspace package', ['site/src/routes/+page.svelte']],
    ['a package and the progress log', ['packages/sim/src/a.ts', 'docs/refactor/progress.md']],
    ['a package and a changeset', ['packages/sim/src/a.ts', '.changeset/quiet-owls-sing.md']],
  ])('%s: only the affected packages run', (_name, files) => {
    expect(scope(files).tests_full).toBe('false')
  })

  it('a change to documentation nothing reads runs no package at all, and is still docs only', () => {
    const out = scope(['docs/refactor/progress.md'])
    expect(out.tests_full).toBe('false')
    expect(out.docs_only).toBe('true')
  })

  // A change turbo cannot place in a package: everything runs. The unit tests of repo-hygiene read the workflows, the
  // root package.json and lefthook.yml; the site reads docs/guides; examples-runner reads docs/archive; the fonts and
  // pixi-3d are vendored.
  it.each([
    ['the lockfile', ['pnpm-lock.yaml']],
    ['the root package.json', ['package.json']],
    ['turbo.json', ['turbo.json']],
    ['lefthook.yml', ['lefthook.yml']],
    ['a workflow', ['.github/workflows/ci.yml']],
    ['vendor/', ['vendor/ruken/index.js']],
    ['a root Markdown file the repository tests read', ['README.md']],
    ['a guide the website builds', ['docs/guides/editor.md']],
    ['the runbook', ['docs/runbook.md']],
    ['a plan the examples runner reads', ['docs/archive/02-master-delivery-plan.md']],
    ['an art file a test reads', ['docs/art/palettes/duel.txt']],
    ['the changeset configuration', ['.changeset/config.json']],
    ['a package and the lockfile', ['packages/sim/src/a.ts', 'pnpm-lock.yaml']],
    ['a package and a workflow', ['packages/sim/src/a.ts', '.github/workflows/ci.yml']],
    ['a package and vendor/', ['packages/sim/src/a.ts', 'vendor/fonts/README.md']],
  ])('%s: every test runs', (_name, files) => {
    expect(scope(files).tests_full).toBe('true')
  })

  it('a pull request it cannot read (no merge commit) runs everything', () => {
    expect(scope(['packages/sim/src/a.ts'], { noMerge: true }).tests_full).toBe('true')
  })

  it('covers every workspace folder pnpm lists, so a new one is not forever a full run', () => {
    const workspace = parse(readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8')) as { packages: string[] }
    const folders = [...new Set(workspace.packages.map((pattern) => pattern.split('/')[0] as string))]
    for (const folder of folders) {
      const file = folder === 'site' ? 'site/src/a.ts' : `${folder}/some-package/src/a.ts`
      expect(scope([file]).tests_full, folder).toBe('false')
    }
  })
})

/** Evaluate the one-line `if:` / env expressions this workflow uses (`==`, `!=`, `&&`, `||`, dotted paths, strings). */
function evaluate(expression: string, context: Record<string, unknown>): unknown {
  const body = expression.replace(/^\s*\$\{\{/, '').replace(/\}\}\s*$/, '')
  return new Function(...Object.keys(context), `return (${body})`)(...Object.values(context))
}

/** The facts the expressions read: the event, whether the scope step wants a full run (as step and job output). */
function context(event: string, testsFull: 'true' | 'false' | ''): Record<string, unknown> {
  return {
    github: { event_name: event, ref: event === 'push' ? 'refs/heads/main' : 'refs/pull/1/merge' },
    inputs: { spec: '' },
    steps: { scope: { outputs: { tests_full: testsFull } } },
    needs: { checks: { outputs: { tests_full: testsFull } } },
    vars: {},
  }
}

const RUNS = [
  ['a push to main', context('push', '')],
  ['the nightly run', context('schedule', '')],
  ['a manual run', context('workflow_dispatch', '')],
  ['a pull request outside the packages', context('pull_request', 'true')],
] as const
const NARROW = ['a pull request inside the packages', context('pull_request', 'false')] as const

describe('the checks job', () => {
  const full = checks?.steps.find((step) => step.run === 'pnpm test:unit')
  const narrow = checks?.steps.find((step) => step.run === 'pnpm test:unit:affected')

  it('has a step for every unit test and a step for the affected ones', () => {
    expect(full).toBeDefined()
    expect(narrow).toBeDefined()
  })

  it.each(RUNS)('%s runs every unit test, not the affected ones', (_name, ctx) => {
    expect(evaluate(full?.if ?? 'true', ctx)).toBeTruthy()
    expect(evaluate(narrow?.if ?? 'true', ctx)).toBeFalsy()
  })

  it(`${NARROW[0]} runs the affected unit tests, not every one`, () => {
    expect(evaluate(full?.if ?? 'true', NARROW[1])).toBeFalsy()
    expect(evaluate(narrow?.if ?? 'true', NARROW[1])).toBeTruthy()
  })

  it('compares the pull request with its base, as the parity job does', () => {
    expect(narrow?.env).toEqual({ TURBO_SCM_BASE: 'HEAD^1', TURBO_SCM_HEAD: 'HEAD' })
  })

  it('hands the scope decision to the jobs after it', () => {
    expect(checks?.outputs?.tests_full).toBe('${{ steps.scope.outputs.tests_full }}')
  })

  it('still runs the whole-repository checks on every run', () => {
    const runs = checks?.steps.filter((step) => step.if === undefined).map((step) => step.run)
    for (const command of [
      'pnpm lint',
      'pnpm typecheck',
      'pnpm boundaries',
      'pnpm style',
      'pnpm knip',
      'pnpm audit:deps',
      'pnpm secrets',
    ])
      expect(runs).toContain(command)
  })
})

describe('the 2D journeys job', () => {
  const journeys = (e2e?.steps ?? []).filter((step) =>
    /pnpm \$\{?E2E_SCRIPT\}?|pnpm test:e2e/.test(step.run ?? ''),
  )

  it('has the four journey steps', () => {
    expect(journeys.map((step) => step.name)).toEqual([
      expect.stringContaining('2D journeys'),
      expect.stringContaining("editor's journeys"),
      expect.stringContaining('website'),
      expect.stringContaining("stranger's journey"),
    ])
  })

  it('picks the script by the event: affected only on a pull request that stays inside the packages', () => {
    const expression = e2e?.env?.E2E_SCRIPT ?? ''
    for (const [name, ctx] of RUNS) expect(evaluate(expression, ctx), name).toBe('test:e2e')
    expect(evaluate(expression, NARROW[1])).toBe('test:e2e:affected')
  })

  it('runs the journeys through that script, with the same filters as before', () => {
    expect(journeys.map((step) => step.run)).toEqual([
      'pnpm $E2E_SCRIPT --filter @af-games/emberwick --filter @af-examples/examples-2d --filter @af-examples/2d-story',
      'pnpm $E2E_SCRIPT --filter @automata/editor',
      'pnpm $E2E_SCRIPT --filter @automata/site',
      'pnpm test:e2e --filter @automata/consumer-smoke',
    ])
  })

  it("leaves the stranger's journey to its own condition: it names packages turbo's graph does not", () => {
    const stranger = journeys.at(-1)
    expect(stranger?.if).toContain("needs.checks.outputs.stranger == 'true'")
  })

  it('fetches the base commit, so turbo can compare with it', () => {
    const checkout = e2e?.steps.find((step) =>
      String((step as { uses?: string }).uses).startsWith('actions/checkout'),
    )
    expect((checkout as { with?: Record<string, unknown> }).with?.['fetch-depth']).toBe(2)
  })

  it('compares the pull request with its base', () => {
    expect(e2e?.env?.TURBO_SCM_BASE).toBe('HEAD^1')
    expect(e2e?.env?.TURBO_SCM_HEAD).toBe('HEAD')
  })
})
