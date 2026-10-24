import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

// The workflows are part of the ship lane's contract (ship spec §3.7): what runs on every push, what runs
// only nightly or on request, and how a game's repository reuses them. These tests pin that shape.

const root = fileURLToPath(new URL('../../..', import.meta.url))
const workflowText = (name: string): string => readFileSync(join(root, '.github/workflows', name), 'utf8')

interface Step {
  readonly id?: string
  readonly uses?: string
  readonly run?: string
  readonly name?: string
  readonly if?: string
  readonly env?: Record<string, string>
  readonly with?: Readonly<Record<string, string | undefined>>
}
interface Job {
  readonly 'runs-on'?: string
  readonly 'timeout-minutes'?: number
  readonly environment?: string
  readonly permissions?: Record<string, string>
  readonly outputs?: Record<string, string>
  readonly if?: string
  readonly needs?: string | string[]
  readonly uses?: string
  readonly with?: Record<string, unknown>
  readonly container?: { image: string }
  readonly steps?: Step[]
}
interface Workflow {
  readonly on: Record<
    string,
    { inputs?: Record<string, unknown>; secrets?: Record<string, unknown>; types?: string[] } | null
  >
  readonly permissions?: Record<string, string>
  readonly jobs: Record<string, Job>
}
const workflow = (name: string): Workflow => parse(workflowText(name)) as Workflow
const packageJson = (path: string) => JSON.parse(readFileSync(join(root, path, 'package.json'), 'utf8'))
// What the root scripts that CI calls put in front of turbo: two vitest workers on CI, the caller's own count if it
// sets one, nothing locally (see 'the load one CI job puts on the shared Mac').
const VITEST_CAP = 'VITEST_MAX_WORKERS=${VITEST_MAX_WORKERS:-${CI:+2}}'

const ALL = ['ci.yml', 'game-ci.yml', 'game-release.yml', 'release-packages.yml', 'consumer-smoke.yml']

describe('every workflow', () => {
  it.each(ALL)('%s pins third-party actions to a commit, as Ruken does', (name) => {
    const uses = Object.values(workflow(name).jobs).flatMap((job) =>
      (job.steps ?? []).map((step) => step.uses),
    )
    for (const action of uses.filter(
      (value): value is string => value !== undefined && !value.startsWith('./'),
    )) {
      expect(action).toMatch(/@[0-9a-f]{40}$/)
    }
  })

  it.each(ALL)('%s never puts inputs or event text straight into a shell script', (name) => {
    const runs = Object.values(workflow(name).jobs).flatMap((job) =>
      (job.steps ?? []).map((step) => step.run ?? ''),
    )
    for (const script of runs) expect(script).not.toMatch(/\$\{\{\s*(inputs|github\.event|github\.head_ref)/)
  })

  it.each(ALL)(
    "%s hands a container job's files back to the runner user, or the next job on the runner cannot check out",
    (name) => {
      // A container job runs as root in the runner's shared work folder; root-owned node_modules then break the
      // next job's checkout (PR #6 on af-linux, 2026-10-11). always() also runs when the job is cancelled.
      for (const job of Object.values(workflow(name).jobs).filter((each) => each.container !== undefined)) {
        // Only a Linux runner has /__w; on af-mac the job runs on the host with no container (below).
        const last = job.steps?.at(-1)
        expect(last?.if).toBe("always() && runner.os == 'Linux'")
        expect(last?.run).toContain('chown -R')
        expect(last?.run).toContain('/__w')
        expect(last?.run).toContain('/__t')
      }
    },
  )

  it.each(ALL)(
    "%s trusts a container job's checkout in git's system config, which every HOME reads",
    (name) => {
      // The checkout belongs to the runner user, so git run as root needs safe.directory. A --global setting lands
      // in HOME's .gitconfig, and the parity and evidence steps set HOME to /root for Firefox: there git did not
      // read it, and `pnpm evidence` failed on main's first push after DX.9 (2026-10-17).
      for (const job of Object.values(workflow(name).jobs).filter((each) => each.container !== undefined)) {
        for (const step of (job.steps ?? []).filter((each) => each.run?.includes('safe.directory')))
          expect(step.run).toContain('git config --system --add safe.directory')
      }
    },
  )

  it.each(ALL)('%s reads the repository and nothing more by default', (name) => {
    expect(workflow(name).permissions).toEqual({ contents: 'read' })
  })
})

describe("runners (D-5: the Owner's self-hosted runners; hosted jobs get no runner on this account)", () => {
  const ci = workflow('ci.yml')

  it.each(['checks', 'e2e', 'frame-budget'])(
    'ci.yml %s runs on the AF runner label, switchable by vars.AF_LINUX_RUNNER, never falling back to hosted',
    (name) => {
      const runsOn = ci.jobs[name]?.['runs-on'] ?? ''
      expect(runsOn).toContain('vars.AF_LINUX_RUNNER')
      expect(runsOn).toContain("'af-linux'")
      expect(runsOn).not.toContain('ubuntu-latest')
    },
  )

  // Parity moved to the Owner's Mac (2026-10-17), so it no longer queues behind Ruken on the shared af-linux PC.
  // vars.AF_PARITY_RUNNER moves it elsewhere; any runner but af-mac runs it in the pinned Playwright container.
  it('ci.yml parity runs on af-mac by default, switchable by vars.AF_PARITY_RUNNER, never falling back to hosted', () => {
    const parity = ci.jobs.parity
    expect(parity?.['runs-on']).toBe("${{ vars.AF_PARITY_RUNNER || 'af-mac' }}")
    expect(parity?.container?.image).toContain("(vars.AF_PARITY_RUNNER || 'af-mac') != 'af-mac'")
  })

  it('installs the browsers on the host only on macOS, where there is no container, and sets HOME only in it', () => {
    const steps = ci.jobs.parity?.steps ?? []
    const install = steps.find((step) => step.run?.includes('playwright install'))
    expect(install?.if).toBe("runner.os == 'macOS'")
    expect(install?.run).toBe('pnpm exec playwright install chromium-headless-shell webkit firefox')
    expect(steps.find((step) => step.run?.includes('safe.directory'))?.if).toBe("runner.os == 'Linux'")
    // Firefox refuses to run as root under Actions' HOME in the container; on the Mac the runner's own HOME is
    // right, so root's HOME is set for the later steps on Linux only, before parity and evidence.
    const home = steps.findIndex((step) => step.run === 'echo "HOME=/root" >> "$GITHUB_ENV"')
    expect(steps[home]?.if).toBe("runner.os == 'Linux'")
    expect(home).toBeLessThan(steps.findIndex((step) => step.run === 'pnpm test:parity'))
    for (const step of steps) expect(step.env?.HOME).toBeUndefined()
  })

  it('passes the same runner to the placeholder through game-ci', () => {
    expect(ci.jobs.placeholder?.with?.runner).toBe("${{ vars.AF_LINUX_RUNNER || 'af-linux' }}")
  })

  it.each(['game-ci.yml', 'game-release.yml'])(
    '%s takes its runner as an input (a game repository has its own runners)',
    (name) => {
      const reusable = workflow(name)
      expect(Object.keys(reusable.on.workflow_call?.inputs ?? {})).toContain('runner')
      for (const job of Object.values(reusable.jobs)) expect(job['runs-on']).toBe('${{ inputs.runner }}')
    },
  )

  it.each(ALL)(
    '%s keeps pnpm in a per-job folder and saves the Actions cache only on hosted runners',
    (name) => {
      for (const job of Object.values(workflow(name).jobs)) {
        const steps = job.steps ?? []
        for (const step of steps.filter((each) => each.uses?.startsWith('pnpm/action-setup@'))) {
          expect(step.with?.dest).toBe('${{ runner.temp }}/setup-pnpm')
        }
        for (const step of steps.filter((each) => each.uses?.startsWith('actions/setup-node@'))) {
          expect(step.with?.cache).toBe("${{ runner.environment == 'github-hosted' && 'pnpm' || '' }}")
        }
      }
    },
  )
})

describe('parity across packages', () => {
  const ci = workflow('ci.yml')
  const foldersIn = (group: string): string[] =>
    readdirSync(join(root, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== 'node_modules')
      .map((entry) => `${group}/${entry.name}`)
  const hasPackageJson = (path: string): boolean => {
    try {
      readFileSync(join(root, path, 'package.json'))
      return true
    } catch {
      return false
    }
  }
  // The workspace globs: packages/*, tooling/*, games/*, examples/* and examples/*/* (pnpm-workspace.yaml).
  const workspacePackages = [
    ...['packages', 'tooling', 'games', 'examples'].flatMap(foldersIn),
    ...foldersIn('examples').flatMap(foldersIn),
  ].filter(hasPackageJson)

  // EX-D1: games (Emberwick, the placeholder) live apart from the one-file examples.
  it('lists the games folder in the workspace', () => {
    const globs = readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8')
    expect(globs).toMatch(/^\s*- games\/\*$/m)
    expect(workspacePackages).toEqual(expect.arrayContaining(['games/emberwick', 'games/placeholder']))
  })

  it("runs every package's parity suite through the root test:parity script", () => {
    // Three suites at a time: each starts Chromium, WebKit and Firefox, and on the shared WSL Docker runner all of
    // #14's eight suites at once left Firefox past vitest's 60 s connect timeout (2026-10-11). The longer connect
    // timeout, passed through to every suite's vitest, is a backstop for a busy runner. 120 s was not enough on
    // af-linux: on 2026-10-16 (PR #39, run 38862520260) sim's suite failed to connect to Firefox within it while
    // every test that ran passed, so it is 240 s. Tests get test:unit's 90 s default (below) instead of browser
    // mode's 15 s: on af-mac's first run (2026-10-17, PR #75, run 39073430409) examples-runner's first golden,
    // which imports a whole game cold, took 15.9 s in Chromium and 17.0 s in WebKit.
    expect(packageJson('.').scripts['test:parity']).toBe(
      `${VITEST_CAP} turbo run test:parity --concurrency=3 -- --browser.connectTimeout=240000 --testTimeout=90000`,
    )
    expect(JSON.stringify(ci.jobs.parity?.steps)).toContain('pnpm test:parity')
  })

  // af-linux is one PC shared with Ruken's GPU runs. Under that load, tests that build worlds or import whole
  // entry modules ran past vitest's 5 s default (main after #16: sim's snapshot test at 5.2 s; #15: base-2d's
  // exports test), and then past 30 s while Ruken's CI ran alongside (2026-10-16: base-2d's exports test at
  // 30.5 s, physics parity at 32–33 s, content's render-types file at 70.7 s). The root script passes a 90 s
  // default to every package's vitest, which still catches a hang; a test's own timeout still wins.
  it('gives every unit suite a 90 s default timeout through the root test:unit script', () => {
    expect(packageJson('.').scripts['test:unit']).toBe(
      `${VITEST_CAP} turbo run test:unit -- --testTimeout=90000`,
    )
    // The flag only means something to vitest, so every package's test:unit must be a vitest run.
    for (const path of workspacePackages) {
      const script = packageJson(path).scripts?.['test:unit']
      if (script !== undefined) expect(script, path).toMatch(/^vitest run( |$)/)
    }
  })

  // A test's own timeout overrides that 90 s default, so a smaller one still failed on af-linux: on 2026-10-16
  // (PR #39, run 38862520260) runtime's root-exports test took 28.5 s against its own 15 s. Every per-test or
  // per-describe budget must be at least the root default. `vi.waitFor(..., { timeout })` is a wait, not a test
  // budget, so it is left out.
  it('keeps every explicit per-test and per-describe timeout at 90 s or more', () => {
    const testFiles = execFileSync(
      'git',
      ['ls-files', 'packages/*.test.ts', 'examples/*.test.ts', 'tooling/*.test.ts', 'games/*.test.ts'],
      { cwd: root, encoding: 'utf8' },
    )
      .split('\n')
      .filter((file) => file !== '')
    // `}, 15000)` closing a test/describe callback, and `{ timeout: N }` passed on a test/describe line.
    const trailingBudget = /^\s*\}\s*,\s*([\d_]+)\s*\)/
    const optionsBudget = /\b(?:it|test|describe)\b[\w.]*\(.*\btimeout:\s*([\d_]+)/
    const tooShort: string[] = []
    for (const file of testFiles) {
      readFileSync(join(root, file), 'utf8')
        .split('\n')
        .forEach((line, index) => {
          if (/\bwaitFor\(/.test(line)) return
          const budget = trailingBudget.exec(line)?.[1] ?? optionsBudget.exec(line)?.[1]
          if (budget !== undefined && Number(budget.replaceAll('_', '')) < 90_000) {
            tooShort.push(`${file}:${index + 1}`)
          }
        })
    }
    expect(tooShort).toEqual([])
  })

  it('gives every package with a browsers vitest project a test:parity script', () => {
    const withBrowsers = workspacePackages.filter((path) => {
      try {
        return /name:\s*'browsers'/.test(readFileSync(join(root, path, 'vitest.config.ts'), 'utf8'))
      } catch {
        return false
      }
    })
    expect(withBrowsers).toContain('packages/sim')
    expect(withBrowsers).toContain('games/emberwick')
    // A package may add more browser projects to the same run (base-2d adds its Chromium renderer tests).
    for (const path of withBrowsers) {
      expect(packageJson(path).scripts['test:parity']).toMatch(
        /^vitest run --project browsers( --project [\w-]+)*$/,
      )
    }
  })
})

// af-mac, af-mac-2 and af-mac-web are three runners on one Mac M1. On 2026-10-23 their jobs ran at a load average up
// to 115 and every failure was a 30 s or 90 s timeout (hub, automata/inbox/2026-10-23-1705-hub-cap-test-workers.md).
// Nothing capped what one job starts: Playwright's default of half the cores per run, turbo's 10 packages at once
// with vitest's `cores - 1` workers each (more than 70 threads on 8 cores), and nine parity browsers each opening
// `cores - 1` pages. Vitest reads VITEST_MAX_WORKERS for every project, browser and layout projects included, so
// the root scripts that CI calls set it; turbo's strict environment would drop it, so turbo.json passes it on.
describe('the load one CI job puts on the shared Mac', () => {
  const scripts = packageJson('.').scripts as Record<string, string>
  const turbo = JSON.parse(readFileSync(join(root, 'turbo.json'), 'utf8')) as {
    concurrency?: string
    globalPassThroughEnv?: string[]
  }
  const CAPPED = ['test:unit', 'test:parity', 'evidence']

  it('starts two vitest workers per project on CI, in the three root scripts that CI calls', () => {
    for (const name of CAPPED) expect(scripts[name], name).toMatch(/^VITEST_MAX_WORKERS=\S+ turbo run /)
    const ci = workflow('ci.yml')
    const calls = JSON.stringify(ci.jobs)
    for (const name of ['test:unit', 'test:parity', 'evidence']) expect(calls).toContain(`pnpm ${name}`)
  })

  it('caps only on CI: two there, the caller’s own count if it sets one, empty (vitest ignores it) otherwise', () => {
    // The real prefix, run by sh with a bare environment. Vitest only reads a non-empty VITEST_MAX_WORKERS.
    const prefix = /^(VITEST_MAX_WORKERS=\S+) turbo run /.exec(scripts['test:unit'] ?? '')?.[1] ?? ''
    const workers = (env: Record<string, string>): string =>
      execFileSync('sh', ['-c', `${prefix} printenv VITEST_MAX_WORKERS`], {
        env: { PATH: process.env.PATH ?? '', ...env },
        encoding: 'utf8',
      }).trim()
    expect(workers({}), 'a developer').toBe('')
    expect(workers({ CI: 'true' }), 'CI').toBe('2')
    expect(workers({ CI: 'true', VITEST_MAX_WORKERS: '3' }), 'CI with an override').toBe('3')
    expect(workers({ VITEST_MAX_WORKERS: '5' }), 'a developer with a count').toBe('5')
  })

  it('lets turbo hand VITEST_MAX_WORKERS to its tasks, and runs at most four packages at once', () => {
    expect(turbo.globalPassThroughEnv).toContain('VITEST_MAX_WORKERS')
    // Four packages with two workers each are eight threads. The parity scripts' own `--concurrency=3` still wins.
    expect(turbo.concurrency).toBe('4')
  })
})

describe('pnpm ci:local (the local gate while no runner serves AF)', () => {
  const ci = workflow('ci.yml')
  const scripts = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts as Record<
    string,
    string
  >
  const localSteps = (scripts['ci:local'] ?? '').split(' && ')

  it('runs every pnpm step of the checks and parity jobs, in order, from a frozen install', () => {
    const ciSteps = ['checks', 'parity'].flatMap((name) =>
      (ci.jobs[name]?.steps ?? [])
        // The Mac host's browser download is runner setup, not a check (a local run has its browsers).
        .filter((step) => step.if !== "runner.os == 'macOS'")
        .map((step) => step.run ?? '')
        .filter((script) => script.startsWith('pnpm ')),
    )
    expect(localSteps[0]).toBe('pnpm install --frozen-lockfile')
    const inOrder = localSteps.filter((step) => ciSteps.includes(step))
    expect(inOrder).toEqual([...new Set(ciSteps)])
  })

  it('builds and prepares the placeholder as game-ci does', () => {
    expect(localSteps).toContain('pnpm --filter @af-examples/placeholder build')
    expect(localSteps).toContain('pnpm --filter @af-examples/placeholder prepare-ruken')
  })

  it('builds every feature demo (examples/README.md: CI builds every demo)', () => {
    expect(scripts['build:demos']).toBe('pnpm --filter "./examples/*/*" build')
    expect(JSON.stringify(ci.jobs.checks?.steps)).toContain('pnpm build:demos')
    expect(localSteps).toContain('pnpm build:demos')
  })

  it('builds every one-file example (EX spec §5), beside the old demos until EX.4 deletes them', () => {
    expect(scripts['build:examples']).toBe('pnpm --filter @af-examples/examples build')
    expect(JSON.stringify(ci.jobs.checks?.steps)).toContain('pnpm build:examples')
    expect(localSteps).toContain('pnpm build:examples')
  })

  it('builds and prepares base-2d, without repeating its check inside AF', () => {
    // build:demos only covers `examples/*/*`; the games (Emberwick, the placeholder) live in `games/`, so they build here.
    expect(localSteps).toContain('pnpm --filter @af-examples/base-2d build')
    expect(localSteps).toContain('pnpm --filter @af-examples/base-2d prepare-ruken')
    // `pnpm check` already runs base-2d's check (typecheck + test:unit + boundaries).
    expect(localSteps).not.toContain('pnpm --filter @af-examples/base-2d check')
  })
})

describe('ci.yml (AF)', () => {
  const ci = workflow('ci.yml')

  it('runs the checks and cross-engine parity on every push and pull request', () => {
    expect(Object.keys(ci.on)).toEqual(
      expect.arrayContaining(['push', 'pull_request', 'schedule', 'workflow_dispatch']),
    )
    const checks = (ci.jobs.checks?.steps ?? []).map((step) => step.run)
    expect(checks).toEqual(
      expect.arrayContaining([
        'pnpm lint',
        'pnpm typecheck',
        'pnpm boundaries',
        'pnpm style',
        'pnpm test:unit',
      ]),
    )
  })

  // af-linux is one shared PC runner. A draft runs parity in a cloud container instead (docs/cloud-parity.md);
  // the runner takes it once the PR is ready for review, and on every push to main.
  it('skips cross-engine parity on draft pull requests and runs it when one is marked ready', () => {
    expect(ci.on.pull_request?.types).toEqual(['opened', 'synchronize', 'reopened', 'ready_for_review'])
    expect(ci.jobs.parity?.if).toContain('github.event.pull_request.draft != true')
    expect(ci.jobs.checks?.if ?? '').not.toContain('draft')
  })

  it('keeps the parity container on the pinned Playwright version', () => {
    const sim = JSON.parse(readFileSync(join(root, 'packages/sim/package.json'), 'utf8'))
    expect(ci.jobs.parity?.container?.image).toContain(
      `'mcr.microsoft.com/playwright:v${sim.devDependencies.playwright}-noble'`,
    )
  })

  it('enforces the S8 budgets: sizes on every run, boot times nightly', () => {
    const checks = (ci.jobs.checks?.steps ?? []).map((step) => step.run)
    expect(checks).toContain('pnpm --filter @af-examples/placeholder budget:size')
    const boot = (ci.jobs.e2e?.steps ?? []).find((step) => step.run?.includes('budget:boot'))
    expect(boot?.if).toBe("inputs.spec == ''")
  })

  it('runs browser journeys only nightly or on request, focused by spec (test:remote)', () => {
    expect(Object.keys(ci.on.workflow_dispatch?.inputs ?? {})).toEqual(['spec', 'nightly'])
    const e2e = ci.jobs.e2e
    expect(e2e?.if).toContain("github.event_name == 'schedule'")
    expect(e2e?.if).toContain("github.event_name == 'workflow_dispatch'")
    expect(e2e?.['runs-on']).toContain('vars.AF_GPU_RUNNER')
    expect(JSON.stringify(e2e?.steps)).toContain('e2e-report')
  })

  // PRODUCT.7 (PRODUCT spec §2 F5): ms/frame on the GPU runner, with the GPU to itself (AGENTS.md), compared
  // with tooling/frame-budget/budget.json, which fails closed until the first GPU-runner run sets it.
  it('runs the frame-budget probe nightly on the GPU runner, alone, and checks it against the recorded budget', () => {
    const job = ci.jobs['frame-budget']
    expect(job?.if).toContain("github.event_name == 'schedule'")
    expect(job?.if).toContain('inputs.nightly')
    expect(job?.if).toContain("inputs.spec == ''")
    expect(job?.['runs-on']).toBe(ci.jobs.e2e?.['runs-on'])
    // After the journeys, never beside them, and one probe at a time across runs.
    expect(job?.needs).toBe('e2e')
    expect(job?.if).toContain('!cancelled()')
    const concurrency = (job as { concurrency?: { group: string; 'cancel-in-progress': boolean } })
      .concurrency
    expect(concurrency).toEqual({ group: 'af-gpu-probe', 'cancel-in-progress': false })
    const runs = (job?.steps ?? []).map((step) => step.run ?? '')
    const probe = runs.indexOf('pnpm test:frame-budget')
    const check = runs.indexOf('pnpm budget:frame')
    expect(probe).toBeGreaterThan(-1)
    expect(check).toBeGreaterThan(probe)
    // The results are the evidence the budget is set from, so they are kept whatever the check said.
    const upload = (job?.steps ?? []).find((step) => step.uses?.startsWith('actions/upload-artifact@'))
    expect(upload?.if).toBe('always()')
    expect(upload?.with?.name).toBe('frame-budget-results')
    expect(upload?.with?.path).toBe('frame-budget-results/')
    const rootPackage = packageJson('.')
    expect(rootPackage.scripts['test:frame-budget']).toBe('AF_FRAME_BUDGET=1 playwright test')
    expect(rootPackage.scripts['budget:frame']).toBe('node tooling/frame-budget/src/check-cli.ts')
  })

  it('runs the journeys with Playwright from the root, with the spec passed straight through', () => {
    const rootPackage = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    expect(rootPackage.scripts['test:e2e']).toBe('playwright test')
    expect(rootPackage.devDependencies['@playwright/test']).toBeDefined()
    const scripts = (ci.jobs.e2e?.steps ?? []).map((step) => step.run ?? '').join('\n')
    // No `--`: Playwright takes everything after one as files and stops filtering, so the run would select
    // every journey instead of the one asked for.
    expect(scripts).toContain('pnpm test:e2e $SPEC')
  })

  it('installs all three engines for the journeys: the input matrix runs cells in WebKit and Firefox (M4.10)', () => {
    const installs = (ci.jobs.e2e?.steps ?? [])
      .map((step) => step.run ?? '')
      .filter((run) => run.includes('playwright install'))
    expect(installs.length).toBeGreaterThan(0)
    for (const install of installs) expect(install).toMatch(/chromium webkit firefox$/)
  })

  it('has a journey for the placeholder, so a nightly run cannot pass with nothing to run', () => {
    const config = readFileSync(join(root, 'playwright.config.ts'), 'utf8')
    expect(config).toContain("testDir: 'games/placeholder/e2e'")
    expect(readdirSync(join(root, 'games/placeholder/e2e')).some((name) => name.endsWith('.e2e.ts'))).toBe(
      true,
    )
  })

  it('builds the placeholder through the reusable game workflow', () => {
    expect(ci.jobs.placeholder?.uses).toBe('./.github/workflows/game-ci.yml')
    expect(ci.jobs.placeholder?.with?.['working-directory']).toBe('games/placeholder')
  })

  it('builds base-2d through the reusable game workflow, with the determinism check on its sim', () => {
    expect(ci.jobs['base-2d']?.uses).toBe('./.github/workflows/game-ci.yml')
    expect(ci.jobs['base-2d']?.with?.['working-directory']).toBe('games/emberwick')
    expect(ci.jobs['base-2d']?.with?.['sim-roots']).toBe('src/sim')
    expect(ci.jobs['base-2d']?.with?.runner).toBe("${{ vars.AF_LINUX_RUNNER || 'af-linux' }}")
  })

  it('gives each game-ci caller its own artifact name, since one run cannot upload two artifacts of the same name', () => {
    const names = Object.values(ci.jobs)
      .filter((job) => job.uses === './.github/workflows/game-ci.yml')
      .map((job) => job.with?.['artifact-name'] ?? 'game-dist')
    expect(names.length).toBeGreaterThan(1)
    expect(new Set(names).size).toBe(names.length)
  })
})

describe('ci.yml evidence file (DX spec §3.10)', () => {
  const ci = workflow('ci.yml')
  const steps = ci.jobs.parity?.steps ?? []
  const scripts = packageJson('.').scripts as Record<string, string>
  const GOLDEN_PACKAGES = [
    'packages/sim',
    'packages/testing',
    'packages/physics',
    'games/emberwick',
    'examples/physics/bodies-2d',
  ]

  it('runs every golden package’s test:evidence, then writes evidence.json from their reports', () => {
    expect(scripts.evidence).toBe(
      `${VITEST_CAP} turbo run test:evidence --concurrency=3 -- --browser.connectTimeout=120000 && node tooling/evidence/src/cli.ts`,
    )
    for (const path of GOLDEN_PACKAGES)
      expect(packageJson(path).scripts['test:evidence'], path).toMatch(
        /^vitest run (--project [\w-]+ )+(\S+\.test\.ts )+--reporter=default --reporter=json --outputFile\.json=\.evidence\/goldens\.json$/,
      )
  })

  it('writes the evidence file on pushes to main only, after parity passed, in the parity job', () => {
    const parity = steps.findIndex((step) => step.run === 'pnpm test:parity')
    const evidence = steps.findIndex((step) => step.run === 'pnpm evidence')
    expect(evidence).toBeGreaterThan(parity)
    expect(steps[evidence]?.if).toBe("github.event_name == 'push'")
  })

  it('uploads evidence.json and its JSON Schema as the `evidence` artifact, before the work folder is handed back', () => {
    const upload = steps.findIndex((step) => step.uses?.startsWith('actions/upload-artifact@'))
    expect(upload).toBeGreaterThan(steps.findIndex((step) => step.run === 'pnpm evidence'))
    expect(upload).toBeLessThan(steps.length - 1)
    expect(steps[upload]?.if).toBe("github.event_name == 'push'")
    expect(steps[upload]?.with?.name).toBe('evidence')
    expect(steps[upload]?.with?.path).toBe('evidence.json\nevidence.schema.json\n')
    expect(steps[upload]?.with?.['if-no-files-found']).toBe('error')
  })

  it('fetches the release tags, so the file can say which package versions were released', () => {
    const checkout = steps.find((step) => step.uses?.startsWith('actions/checkout@'))
    expect(checkout?.with?.['fetch-tags'] as unknown).toBe(true)
  })

  it('runs the evidence step in ci:local too, after parity', () => {
    const local = (scripts['ci:local'] ?? '').split(' && ')
    expect(local.indexOf('pnpm evidence')).toBe(local.indexOf('pnpm test:parity') + 1)
  })
})

describe('ci.yml release checks (M2.4 spec §3.5)', () => {
  const ci = workflow('ci.yml')
  const steps = ci.jobs.checks?.steps ?? []
  const runs = steps.map((step) => step.run ?? '')

  it('checks out full history on pull requests, so changeset status can compare with origin/main', () => {
    const checkout = steps.find((step) => step.uses?.startsWith('actions/checkout@'))
    // Always 0: an expression like `cond && 0 || 1` yields 1, since 0 is falsy in Actions expressions.
    expect(checkout?.with?.['fetch-depth']).toBe(0)
  })

  it('requires a changeset for a changed published package, allows only patch bumps, and builds every package', () => {
    const status = runs.indexOf('pnpm changeset status --since=origin/main')
    const patchOnly = runs.indexOf('node tooling/release/src/check-changesets.ts')
    const build = runs.indexOf('pnpm build')
    const dist = runs.indexOf('pnpm --filter @mcthaydt/release test:dist')
    expect(status).toBeGreaterThan(-1)
    expect(patchOnly).toBeGreaterThan(status)
    expect(build).toBeGreaterThan(patchOnly)
    expect(dist).toBeGreaterThan(build)
    // On a push to main there is nothing to compare with: changeset status runs on pull requests only.
    expect(steps[status]?.if).toBe("github.event_name == 'pull_request'")
  })

  it('runs the same release checks in ci:local', () => {
    const local = (
      JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts['ci:local'] as string
    ).split(' && ')
    for (const step of [
      'pnpm changeset status --since=origin/main',
      'node tooling/release/src/check-changesets.ts',
      'pnpm build',
      'pnpm --filter @mcthaydt/release test:dist',
    ]) {
      expect(local).toContain(step)
    }
  })
})

describe('repo hygiene in ci.yml and ci:local (QB.1)', () => {
  const steps = workflow('ci.yml').jobs.checks?.steps ?? []
  const runs = steps.map((step) => step.run ?? '')
  const local = (
    JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts['ci:local'] as string
  ).split(' && ')

  it.each(['pnpm knip', 'pnpm audit:deps', 'pnpm secrets'])('runs %s in CI and in ci:local', (command) => {
    expect(runs).toContain(command)
    expect(local).toContain(command)
  })

  it('runs knip in pnpm check', () => {
    expect((packageJson('.').scripts.check as string).split(' && ')).toContain('pnpm knip')
  })

  it('reports new dependencies on pull requests, against the base branch', () => {
    const report = steps.find((step) => step.run?.includes('pnpm deps:new'))
    expect(report?.if).toBe("github.event_name == 'pull_request'")
    expect(report?.run).toContain('--base origin/main')
  })
})

describe('release-packages.yml (M2.4 spec §3.5, QB.1b)', () => {
  const release = workflow('release-packages.yml')
  const { plan, version, publish } = release.jobs
  const stepsOf = (job: Job | undefined) => job?.steps ?? []
  const stepIn = (job: Job | undefined, prefix: string) =>
    stepsOf(job).find((each) => each.uses?.startsWith(prefix))
  const changesetsIn = (job: Job | undefined) => stepIn(job, 'changesets/action@')
  const PUBLISHED = "steps.changesets.outputs.published == 'true'"

  it('has exactly three jobs: plan, version and publish', () => {
    expect(Object.keys(release.jobs)).toEqual(['plan', 'version', 'publish'])
  })

  it('runs on pushes to main only, one release at a time', () => {
    expect(Object.keys(release.on)).toEqual(['push'])
    expect(JSON.stringify(release.on.push)).toContain('main')
    const parsed = parse(workflowText('release-packages.yml')) as { concurrency?: { group: string } }
    expect(parsed.concurrency?.group).toBe('release')
  })

  it('stays off the shared self-hosted runners, since the jobs hold write tokens', () => {
    for (const job of [plan, version, publish]) {
      expect(job?.['runs-on']).toBe('ubuntu-latest')
      expect(job?.['timeout-minutes']).toBe(20)
    }
  })

  it('asks whether the commit carries changesets, the question changesets/action asks, with no token and no environment', () => {
    expect(plan?.environment).toBeUndefined()
    expect(plan?.permissions).toEqual({ contents: 'read' })
    expect(plan?.outputs).toEqual({ pending: '${{ steps.scan.outputs.pending }}' })
    const check = stepsOf(plan).find((each) => each.id === 'scan')
    expect(check?.run).toContain("find .changeset -maxdepth 1 -name '*.md' ! -name README.md")
    expect(check?.run).toContain('pending=')
  })

  it('opens or updates the Version packages PR when changesets are pending, with no approval and no way to publish', () => {
    expect(version?.needs).toBe('plan')
    expect(version?.if).toBe("needs.plan.outputs.pending == 'true'")
    expect(version?.environment).toBeUndefined()
    expect(version?.permissions).toEqual({ contents: 'write', 'pull-requests': 'write' })
    const changesets = changesetsIn(version)
    expect(changesets?.uses).toBe('changesets/action@ae32849d5ba541f9ae29e40e22a623bc13562f51')
    // v2 renamed its inputs and fails on the old names (version, publish, commit, title).
    expect(Object.keys(changesets?.with ?? {}).sort()).toEqual([
      'commit-message',
      'pr-title',
      'version-script',
    ])
    expect(changesets?.with?.['version-script']).toBe('pnpm release:version')
    // `[skip ci]`: a push to the Version packages branch starts no ci, parity, game-ci or consumer-smoke run;
    // the release workflow itself checks the commit it releases, so nothing needs the branch's own runs.
    expect(changesets?.with?.['commit-message']).toBe('chore: version packages [skip ci]')
    expect(changesets?.with?.['pr-title']).toBe('Version packages')
    expect(changesets?.env?.GITHUB_TOKEN).toBe('${{ secrets.GITHUB_TOKEN }}')
    expect(JSON.stringify(version)).not.toContain('NODE_AUTH_TOKEN')
  })

  it('waits for the Owner only to publish: the publish job alone runs in the release environment (QB.1, QB.1b)', () => {
    expect(publish?.needs).toBe('plan')
    expect(publish?.if).toBe("needs.plan.outputs.pending == 'false'")
    expect(publish?.environment).toBe('release')
    expect(version?.environment).toBeUndefined()
    expect(plan?.environment).toBeUndefined()
  })

  it('lets the publish job write contents and packages, and the version job contents and pull requests, nothing else', () => {
    expect(publish?.permissions).toEqual({ contents: 'write', packages: 'write' })
    expect(version?.permissions).toEqual({ contents: 'write', 'pull-requests': 'write' })
  })

  it('publishes with the workflow token when nothing is pending, and never versions', () => {
    const changesets = changesetsIn(publish)
    expect(changesets?.uses).toBe('changesets/action@ae32849d5ba541f9ae29e40e22a623bc13562f51')
    expect((changesets as { id?: string }).id).toBe('changesets')
    expect(Object.keys(changesets?.with ?? {}).sort()).toEqual(['publish-script'])
    expect(changesets?.with?.['publish-script']).toBe('pnpm release')
    expect(changesets?.env?.NODE_AUTH_TOKEN).toBe('${{ secrets.GITHUB_TOKEN }}')
    expect(changesets?.env?.GITHUB_TOKEN).toBe('${{ secrets.GITHUB_TOKEN }}')
  })

  it('checks out full history without keeping the write token in .git/config, and points npm at GitHub Packages', () => {
    for (const job of [plan, version, publish]) {
      // changesets/action pushes through the GitHub API with its own token input, so git never needs it.
      expect(stepIn(job, 'actions/checkout@')?.with?.['persist-credentials']).toBe(false)
    }
    for (const job of [version, publish])
      expect(stepIn(job, 'actions/checkout@')?.with?.['fetch-depth']).toBe(0)
    const node = stepIn(publish, 'actions/setup-node@')
    expect(node?.with?.['registry-url']).toBe('https://npm.pkg.github.com')
    expect(node?.with?.scope).toBe('@mcthaydt')
    expect(node?.with?.['node-version-file']).toBe('.nvmrc')
  })

  it('after a publish only: verifies every package is on the registry, then installs them from outside', () => {
    const steps = stepsOf(publish)
    const after = steps.slice(steps.indexOf(changesetsIn(publish) as Step) + 1)
    const released = after.find((each) => each.run?.includes('released-version.ts'))
    const verify = after.find((each) => each.run?.includes('verify-published.ts'))
    const smoke = after.find((each) => each.run?.includes('consumer-smoke/src/run.ts'))
    for (const each of [released, verify, smoke]) expect(each?.if).toBe(PUBLISHED)
    expect(released?.env?.PUBLISHED).toBe("${{ steps.changesets.outputs['published-packages'] }}")
    expect(verify?.run).toContain('--version "$VERSION"')
    expect(smoke?.run).toContain('--from registry --version "$VERSION"')
    expect(after.indexOf(verify as Step)).toBeLessThan(after.indexOf(smoke as Step))
    for (const each of [verify, smoke]) expect(each?.env?.NODE_AUTH_TOKEN).toBe('${{ secrets.GITHUB_TOKEN }}')
    expect(JSON.stringify(stepsOf(version))).not.toContain('verify-published')
  })

  it('publishes without --provenance (GitHub Packages does not document it; spec §8)', () => {
    expect(JSON.stringify(release.jobs)).not.toMatch(/provenance/i)
    expect(packageJson('.').scripts.release).not.toMatch(/provenance/i)
  })

  it('builds before publishing, so a fresh checkout never publishes packages without dist', () => {
    expect(packageJson('.').scripts.release).toBe('pnpm build && changeset publish')
  })

  it.each([
    ['version', version],
    ['publish', publish],
  ] as const)(
    'runs the unit gate on the commit it acts on in the %s job, before the action',
    (_name, job) => {
      const steps = stepsOf(job)
      const check = steps.findIndex((each) => each.run === 'pnpm check')
      expect(check).toBeGreaterThan(-1)
      expect(check).toBeLessThan(steps.indexOf(changesetsIn(job) as Step))
    },
  )
})

describe('consumer smoke (M2.4 spec §3.6, §4)', () => {
  it('runs nightly in the e2e job, after building the packages', () => {
    const steps = workflow('ci.yml').jobs.e2e?.steps ?? []
    const build = steps.findIndex((step) => step.run === 'pnpm build')
    const smoke = steps.findIndex(
      (step) => step.run === 'node tooling/consumer-smoke/src/run.ts --from packs',
    )
    expect(build).toBeGreaterThan(-1)
    expect(smoke).toBeGreaterThan(build)
    for (const index of [build, smoke]) expect(steps[index]?.if).toBe("inputs.spec == ''")
  })

  it('runs on pull requests that touch build config only, on the AF runner, skipping drafts', () => {
    const smoke = workflow('consumer-smoke.yml')
    expect(Object.keys(smoke.on)).toEqual(['pull_request'])
    const paths = (smoke.on.pull_request as { paths?: string[] }).paths ?? []
    expect(paths).toEqual(
      expect.arrayContaining([
        '**/tsdown.config.ts',
        '**/svelte.config.js',
        '**/package.json',
        '.changeset/**',
        'tooling/release/**',
        'tooling/consumer-smoke/**',
      ]),
    )
    const job = smoke.jobs['consumer-smoke']
    expect(job?.['runs-on']).toBe("${{ vars.AF_LINUX_RUNNER || 'af-linux' }}")
    expect(job?.if).toBe('github.event.pull_request.draft == false')
    const runs = (job?.steps ?? []).map((step) => step.run)
    expect(runs.indexOf('node tooling/consumer-smoke/src/run.ts --from packs')).toBeGreaterThan(
      runs.indexOf('pnpm build'),
    )
  })
})

describe('game-ci.yml (reusable)', () => {
  const gameCi = workflow('game-ci.yml')

  it("is called by a game's own ci.yml with its folder and its sim sources; AF comes from its package.json", () => {
    expect(Object.keys(gameCi.on)).toEqual(['workflow_call'])
    const inputs = Object.keys(gameCi.on.workflow_call?.inputs ?? {})
    expect(inputs).toEqual(expect.arrayContaining(['working-directory', 'sim-roots', 'allow-imports']))
    expect(inputs).not.toContain('af-ref')
  })

  it("runs the determinism checker on the game's sim sources (shared contracts §2), then prepares the build", () => {
    const scripts = (gameCi.jobs.game?.steps ?? []).map((step) => step.run ?? '').join('\n')
    expect(scripts).toContain('pnpm exec automata-check-boundaries $SIM_ROOTS')
    expect(scripts).toContain('pnpm exec automata-ship prepare')
    expect(scripts.indexOf('automata-check-boundaries')).toBeLessThan(
      scripts.indexOf('automata-ship prepare'),
    )
  })

  it('skips Check and the determinism checker inside AF, where the `checks` job already runs them', () => {
    const guard = "github.repository != 'mcthaydt/automata-framework'"
    const steps = gameCi.jobs.game?.steps ?? []
    const check = steps.find((step) => step.name === 'Check')
    const determinism = steps.find((step) => step.run?.includes('automata-check-boundaries'))
    expect(check?.if).toBe(guard)
    expect(determinism?.if).toContain(guard)
  })

  it('passes each allow-imports entry to the checker as --allow-import (M2.1b)', () => {
    const step = (gameCi.jobs.game?.steps ?? []).find((each) =>
      each.run?.includes('automata-check-boundaries'),
    )
    expect(step?.env?.ALLOW_IMPORTS).toBe('${{ inputs.allow-imports }}')
    expect(step?.run).toContain('--allow-import')
  })

  it('uploads the build under the artifact name its caller passes', () => {
    expect(gameCi.on.workflow_call?.inputs).toHaveProperty('artifact-name')
    const upload = (gameCi.jobs.game?.steps ?? []).find((step) =>
      step.uses?.startsWith('actions/upload-artifact@'),
    )
    expect(upload?.with?.name).toBe('${{ inputs.artifact-name }}')
  })
})

describe('reusable workflows called from a game repository (M2.4 spec §3.7)', () => {
  const CLASSIC = 'a classic personal access token with read:packages'

  it.each(['game-ci.yml', 'game-release.yml'])(
    '%s never checks AF out: a read:packages token cannot read its contents, and the tools come from the game',
    (name) => {
      for (const job of Object.values(workflow(name).jobs)) {
        const steps = job.steps ?? []
        expect(
          steps.filter((step) => JSON.stringify(step.with ?? {}).includes('automata-framework')),
        ).toEqual([])
        expect(steps.filter((step) => step.uses?.startsWith('actions/checkout@'))).toHaveLength(1)
        expect(JSON.stringify(steps)).not.toContain('$AF/')
      }
    },
  )

  it.each(['game-ci.yml', 'game-release.yml'])(
    "%s installs AF from GitHub Packages with AF_READ_TOKEN, on the game's own Node version",
    (name) => {
      for (const job of Object.values(workflow(name).jobs)) {
        const steps = job.steps ?? []
        const setupNode = steps.find((step) => step.uses?.startsWith('actions/setup-node@'))
        expect(setupNode?.with?.['node-version-file']).toBe('.nvmrc')
        expect(setupNode?.with?.['registry-url']).toBe('https://npm.pkg.github.com')
        expect(setupNode?.with?.scope).toBe('@mcthaydt')
        const install = steps.find((step) => step.name === 'Install')
        expect(install?.env?.NODE_AUTH_TOKEN).toBe('${{ secrets.AF_READ_TOKEN }}')
        expect(install?.run).toContain('pnpm install --frozen-lockfile')
        expect(install?.run).toContain(CLASSIC)
      }
    },
  )

  it.each(['game-ci.yml', 'game-release.yml'])(
    '%s stops first, naming the token, when a game passes no AF_READ_TOKEN',
    (name) => {
      for (const job of Object.values(workflow(name).jobs)) {
        const steps = job.steps ?? []
        const check = steps.findIndex(
          (step) => step.run?.includes('AF_READ_TOKEN') && step.run.includes('exit 1'),
        )
        const install = steps.findIndex((step) => step.name === 'Install')
        expect(check).toBeGreaterThan(-1)
        expect(check).toBeLessThan(install)
        expect(steps[check]?.if).toBe("github.repository != 'mcthaydt/automata-framework'")
        expect(steps[check]?.run).toContain(`AF_READ_TOKEN (${CLASSIC}) is missing`)
      }
    },
  )

  it.each(['game-ci.yml', 'game-release.yml'])(
    '%s describes AF_READ_TOKEN as a classic read:packages token, in its secrets and its header',
    (name) => {
      const secret = workflow(name).on.workflow_call?.secrets?.AF_READ_TOKEN as { description?: string }
      expect(secret.description?.toLowerCase()).toContain(CLASSIC)
      const header = (workflowText(name).split('\non:')[0] ?? '').replace(/\n#\s*/g, ' ')
      expect(header).toContain(CLASSIC)
      expect(workflowText(name)).not.toMatch(/fine-grained token with|Contents read on/)
    },
  )
})

describe('game-release.yml (reusable)', () => {
  const release = workflow('game-release.yml')

  it('runs ship from the game with pnpm exec, with the same arguments as before', () => {
    const scripts = Object.values(release.jobs)
      .flatMap((job) => (job.steps ?? []).map((step) => step.run ?? ''))
      .join('\n')
    expect(scripts).toContain('pnpm exec automata-ship prepare --tag "$TAG"')
    expect(scripts).toContain('pnpm exec automata-ship publish --tag "$TAG" --game "$GAME"')
    expect(scripts).toContain('pnpm exec automata-ship deploy-dev --tag "$TAG" --activate')
    expect(release.on.workflow_call?.inputs?.runner).toMatchObject({ default: 'ubuntu-latest' })
  })

  it('publishes to the game it is given, and refuses to register a new Ruken game on every release', () => {
    expect(Object.keys(release.on.workflow_call?.inputs ?? {})).toContain('game')
    const publish = (release.jobs.ruken?.steps ?? []).map((step) => step.run ?? '').join('\n')
    expect(publish).toContain('--game "$GAME"')
    expect(publish).toContain('.ruken/project.json')
    expect(publish).toContain('exit 1')
  })

  it('keeps the deploy key out of ~/.ssh and removes it when the job ends', () => {
    const steps = release.jobs['dev-host']?.steps ?? []
    const scripts = steps.map((step) => step.run ?? '').join('\n')
    expect(scripts).not.toContain('~/.ssh')
    expect(scripts).toContain('SHIP_DEV_SSH_KEY_FILE')
    const cleanup = steps.at(-1)
    expect(cleanup?.if).toBe('always()')
    expect(cleanup?.run).toContain('rm -rf')
  })

  it('publishes to Ruken and deploys to the dev host as separate jobs after one build', () => {
    expect(Object.keys(release.on)).toEqual(['workflow_call'])
    expect(release.jobs.ruken?.needs).toBe('build')
    expect(release.jobs['dev-host']?.needs).toBe('build')
    expect(JSON.stringify(release.jobs.ruken?.steps)).toContain('publish')
    expect(JSON.stringify(release.jobs['dev-host']?.steps)).toContain('deploy-dev')
  })

  it('takes the Ruken token and the dev host key as secrets', () => {
    expect(Object.keys(release.on.workflow_call?.secrets ?? {})).toEqual(
      expect.arrayContaining(['RUKEN_TOKEN', 'SHIP_DEV_SSH_KEY']),
    )
  })
})

// The CI backlog (2026-10-23): one runner serves every pull request, so a pull request that cannot change what
// a game builds (documentation only) or that is still a draft runs the checks job alone. Marking a draft ready
// starts the rest (`ready_for_review` is in the pull_request types above).
describe('what a pull request runs (docs-only and draft scope)', () => {
  const ci = workflow('ci.yml')
  const scope = ci.jobs.checks?.steps?.find((step) => step.id === 'scope')

  it('has the checks job decide whether the pull request is documentation only', () => {
    expect(ci.jobs.checks?.outputs?.docs_only).toBe('${{ steps.scope.outputs.docs_only }}')
    expect(scope?.if).toBe("github.event_name == 'pull_request'")
    // Before the install, so a scope failure costs nothing; after the checkout that fetches the history.
    const steps = ci.jobs.checks?.steps ?? []
    expect(steps.indexOf(scope as Step)).toBeGreaterThan(
      steps.findIndex((step) => step.uses?.startsWith('actions/checkout@')),
    )
    expect(steps.indexOf(scope as Step)).toBeLessThan(
      steps.findIndex((step) => step.run === 'pnpm install --frozen-lockfile'),
    )
  })

  it.each(['placeholder', 'base-2d', 'parity'])(
    '%s waits for the checks and, on a pull request, runs only a ready one that changes more than documentation',
    (name) => {
      const job = ci.jobs[name]
      expect(job?.needs).toBe('checks')
      // `!cancelled()` keeps the push, nightly and dispatch behavior: a red checks job does not hide these.
      expect(job?.if).toContain('!cancelled()')
      expect(job?.if).toContain("needs.checks.result == 'success'")
      expect(job?.if).toContain('github.event.pull_request.draft != true')
      expect(job?.if).toContain("needs.checks.outputs.docs_only != 'true'")
      // A focused browser run (test-remote) still skips them, as before.
      expect(job?.if).toContain("inputs.spec == ''")
    },
  )

  describe('the scope step classifies the merge commit that GitHub checks out', () => {
    // Run the step's own script in a scratch repository shaped like a pull request checkout: HEAD is a merge
    // commit whose first parent is the base tip, so HEAD^1..HEAD is exactly the pull request's changes.
    const classify = (changedFiles: readonly string[] | 'not-a-merge'): string => {
      const dir = mkdtempSync(join(tmpdir(), 'af-scope-'))
      try {
        const git = (...args: string[]): string =>
          execFileSync('git', ['-c', 'user.name=ci', '-c', 'user.email=ci@example.com', ...args], {
            cwd: dir,
            encoding: 'utf8',
          })
        const commit = (message: string, files: readonly string[]): void => {
          for (const file of files) {
            execFileSync('mkdir', ['-p', join(dir, file, '..')])
            writeFileSync(join(dir, file), `${message}\n`)
          }
          git('add', '-A')
          git('commit', '-q', '-m', message)
        }
        git('init', '-q', '-b', 'main')
        commit('base', ['README.md', 'packages/a/src/index.ts'])
        if (changedFiles !== 'not-a-merge') {
          git('checkout', '-q', '-b', 'pr')
          commit('pr', changedFiles)
          git('checkout', '-q', 'main')
          commit('main moves on', ['docs/unrelated.md'])
          git('merge', '-q', '--no-ff', '-m', 'merge', 'pr')
        }
        const output = join(dir, 'github-output')
        writeFileSync(output, '')
        execFileSync('bash', ['-e', '-c', scope?.run ?? 'exit 1'], {
          cwd: dir,
          env: { ...process.env, GITHUB_OUTPUT: output },
        })
        return readFileSync(output, 'utf8').trim()
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    }

    it('is docs-only when the pull request changes only docs/ and Markdown files', () => {
      expect(
        classify(['docs/superpowers/specs/new.md', 'docs/design/editor-3d/views.mjs', 'CHANGELOG.md']),
      ).toBe('docs_only=true')
      expect(classify(['packages/a/README.md'])).toBe('docs_only=true')
    })

    it('is not docs-only as soon as one changed file is code, config or a workflow', () => {
      expect(classify(['docs/spec.md', 'packages/a/src/index.ts'])).toBe('docs_only=false')
      expect(classify(['knip.jsonc'])).toBe('docs_only=false')
      expect(classify(['.github/workflows/ci.yml'])).toBe('docs_only=false')
      expect(classify(['docs-extra/tool.ts'])).toBe('docs_only=false')
    })

    it("counts the base branch's own new commits as nobody's changes", () => {
      // classify() moves main on with a docs file after the branch point; a code-only change still shows.
      expect(classify(['packages/a/src/index.ts'])).toBe('docs_only=false')
    })

    it('is not docs-only when the checkout is not a merge commit', () => {
      expect(classify('not-a-merge')).toBe('docs_only=false')
    })
  })
})
