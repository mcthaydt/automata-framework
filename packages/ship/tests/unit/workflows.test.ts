import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

// The workflows are part of the ship lane's contract (ship spec §3.7): what runs on every push, what runs
// only nightly or on request, and how a game's repository reuses them. These tests pin that shape.

const root = fileURLToPath(new URL('../../../..', import.meta.url))
const workflowText = (name: string): string => readFileSync(join(root, '.github/workflows', name), 'utf8')

interface Step {
  readonly id?: string
  readonly uses?: string
  readonly run?: string
  readonly name?: string
  readonly if?: string
  readonly env?: Record<string, string>
  readonly 'working-directory'?: string
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
  readonly env?: Record<string, string>
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

// The packages that leave the core and 2D gate (core-and-2D refactor spec section 3.4): the 3D renderer, its
// figures, the sector format, the base 3D game and the editors run in 3d-and-editors.yml.
const THREE_D_PACKAGES = [
  './packages/editor-*',
  '@af-games/base-3d',
  './packages/render-pixi3d',
  './packages/figures',
  './packages/sector-format',
]
const CORE_FILTERS = THREE_D_PACKAGES.map((each) => `--filter='!${each}'`).join(' ')
const THREE_D_FILTERS = THREE_D_PACKAGES.map((each) => `--filter='${each}'`).join(' ')

const ALL = [
  'ci.yml',
  'game-ci.yml',
  'game-release.yml',
  'release-packages.yml',
  'release-checks.yml',
  '3d-and-editors.yml',
  'consumer-smoke.yml',
]

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

  it.each(['checks', 'e2e-2d', 'e2e-focused', 'frame-budget'])(
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
    expect(home).toBeLessThan(steps.findIndex((step) => step.run === 'pnpm test:browser:core'))
    for (const step of steps) expect(step.env?.HOME).toBeUndefined()
  })

  it('passes the same runner to base-2d through game-ci', () => {
    expect(ci.jobs['base-2d']?.with?.runner).toBe(
      "${{ vars.AF_GAME_RUNNER || vars.AF_LINUX_RUNNER || 'af-linux' }}",
    )
  })

  it.each(['game-ci.yml', 'game-release.yml'])(
    '%s takes its runner as an input (a game repository has its own runners)',
    (name) => {
      const reusable = workflow(name)
      expect(Object.keys(reusable.on.workflow_call?.inputs ?? {})).toContain('runner')
      // Every job runs on a runner the caller passes: `runner`, or for the desktop bundles (one per OS, DIST.5c) a
      // runner from `desktop-runners` or `desktop-macos-runner`.
      for (const job of Object.values(reusable.jobs)) {
        expect([
          '${{ inputs.runner }}',
          '${{ matrix.runner }}',
          '${{ inputs.desktop-macos-runner }}',
        ]).toContain(job['runs-on'])
      }
      for (const [id, job] of Object.entries(reusable.jobs).filter(
        ([, job]) => job['runs-on'] === '${{ matrix.runner }}',
      ))
        expect(JSON.stringify(job), id).toContain('fromJSON(inputs.desktop-runners)')
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

describe('parity across packages', () => {
  const ci = workflow('ci.yml')
  // EX-D1: games (Emberwick) live apart from the one-file examples.
  it('lists the games folder in the workspace', () => {
    const globs = readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8')
    expect(globs).toMatch(/^\s*- games\/\*$/m)
    expect(workspacePackages).toEqual(expect.arrayContaining(['games/emberwick', 'games/base-3d']))
  })

  it("runs every package's parity suite through the root test:browser script", () => {
    // Three suites at a time: each starts Chromium, WebKit and Firefox, and on the shared WSL Docker runner all of
    // #14's eight suites at once left Firefox past vitest's 60 s connect timeout (2026-10-11). The longer connect
    // timeout, passed through to every suite's vitest, is a backstop for a busy runner. 120 s was not enough on
    // af-linux: on 2026-10-16 (PR #39, run 38862520260) sim's suite failed to connect to Firefox within it while
    // every test that ran passed, so it is 240 s. Tests get test:unit's 90 s default (below) instead of browser
    // mode's 15 s: on af-mac's first run (2026-10-17, PR #75, run 39073430409) examples-runner's first golden,
    // which imports a whole game cold, took 15.9 s in Chromium and 17.0 s in WebKit.
    expect(packageJson('.').scripts['test:browser']).toBe(
      `${VITEST_CAP} turbo run test:browser --concurrency=3 -- --browser.connectTimeout=240000 --testTimeout=90000`,
    )
    // The pull request gate runs the core and 2D suites; the 3D and editor suites run in 3d-and-editors.yml.
    expect(packageJson('.').scripts['test:browser:core']).toBe(
      `${VITEST_CAP} turbo run test:browser ${CORE_FILTERS} --concurrency=3 -- --browser.connectTimeout=240000 --testTimeout=90000`,
    )
    expect(packageJson('.').scripts['test:browser:3d']).toBe(
      `${VITEST_CAP} turbo run test:browser ${THREE_D_FILTERS} --concurrency=3 -- --browser.connectTimeout=240000 --testTimeout=90000`,
    )
    expect(JSON.stringify(ci.jobs.parity?.steps)).toContain('pnpm test:browser:core')
    expect(JSON.stringify(workflow('3d-and-editors.yml').jobs['parity-3d']?.steps)).toContain(
      'pnpm test:browser:3d',
    )
    // The pull request variant runs the same suites, only those of the affected packages (turbo --affected).
    expect(packageJson('.').scripts['test:browser:affected']).toBe(
      `${VITEST_CAP} turbo run test:browser --affected ${CORE_FILTERS} --concurrency=3 -- --browser.connectTimeout=240000 --testTimeout=90000`,
    )
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
    // The pull request gate runs the core and 2D suites; the 3D and editor suites have their own script.
    expect(packageJson('.').scripts['test:unit:core']).toBe(
      `${VITEST_CAP} turbo run test:unit ${CORE_FILTERS} -- --testTimeout=90000`,
    )
    expect(packageJson('.').scripts['test:unit:3d']).toBe(
      `${VITEST_CAP} turbo run test:unit ${THREE_D_FILTERS} -- --testTimeout=90000`,
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

  it('gives every package with browser tests a test:browser script', () => {
    // Browser tests sit in `tests/browser`; a package not yet moved (3D and editors) still names a `browsers` project.
    const withBrowsers = workspacePackages.filter((path) => {
      if (existsSync(join(root, path, 'tests/browser'))) return true
      try {
        return /name:\s*'browsers'/.test(readFileSync(join(root, path, 'vitest.config.ts'), 'utf8'))
      } catch {
        return false
      }
    })
    expect(withBrowsers).toContain('packages/sim')
    expect(withBrowsers).toContain('games/emberwick')
    expect(withBrowsers).toContain('games/base-3d')
    // A package may load its config through Vite's module runner (base-3d: its config imports workspace sources,
    // M3.7b part 3), and may add more browser projects to the same run.
    for (const path of withBrowsers) {
      expect(packageJson(path).scripts['test:browser']).toMatch(
        /^vitest run( --configLoader runner)? --project browsers?( --project [\w-]+)*$/,
      )
    }
  })
})

// CI.JRN1: the editors' iPad journeys (EDK.6b's harness, WebKit with touch and a 2x screen) gate every pull request
// that touches the editors or core, in 3d-and-editors.yml. They take seconds, so they run in full rather than through
// turbo --affected.
describe('the iPad journeys (CI.JRN1)', () => {
  const withJourneys = workspacePackages.filter((path) => {
    try {
      // A journeys project is the kit's `journeyProject(...)` (EDK.6b) or one named 'journeys'.
      return /journeyProject\(|name:\s*'journeys'/.test(
        readFileSync(join(root, path, 'vitest.config.ts'), 'utf8'),
      )
    } catch {
      return false
    }
  })

  it('gives every package with a journeys vitest project a test:journeys script, which the root script runs', () => {
    expect(withJourneys).toContain('packages/editor-kit')
    for (const path of withJourneys)
      expect(packageJson(path).scripts['test:journeys']).toMatch(/^vitest run --project journeys/)
    expect(packageJson('.').scripts['test:journeys']).toBe(`${VITEST_CAP} turbo run test:journeys`)
    const turbo = JSON.parse(readFileSync(join(root, 'turbo.json'), 'utf8'))
    expect(turbo.tasks['test:journeys']).toEqual({
      cache: false,
      passThroughEnv: ['PLAYWRIGHT_BROWSERS_PATH'],
    })
  })

  it('runs them in the 3D and editors workflow after installing WebKit, on a hosted runner with its system libraries', () => {
    const steps = workflow('3d-and-editors.yml').jobs['unit-and-journeys']?.steps ?? []
    const runs = steps.map((step) => step.run ?? '')
    const journeys = runs.indexOf('pnpm test:journeys')
    expect(journeys).toBeGreaterThan(-1)
    const installs = steps
      .slice(0, journeys)
      .filter((step) => /playwright install .*webkit/.test(step.run ?? ''))
    expect(installs.map((step) => [step.if, step.run])).toEqual([
      ["runner.environment == 'github-hosted'", 'pnpm exec playwright install --with-deps webkit'],
      ["runner.environment == 'self-hosted'", 'pnpm exec playwright install webkit'],
    ])
  })
})

// af-mac, af-mac-2 and af-mac-web are three runners on one Mac M1. On 2026-10-23 their jobs ran at a load average up
// to 115 and every failure was a 30 s or 90 s timeout (hub, automata/inbox/2026-10-23-1705-hub-cap-test-workers.md).
// Nothing capped what one job starts: Playwright's default of half the cores per run, turbo's 10 packages at once
// with vitest's `cores - 1` workers each (more than 70 threads on 8 cores), and nine parity browsers each opening
// `cores - 1` pages. Vitest reads VITEST_MAX_WORKERS for every project, browser and layout projects included, so
// the root scripts that CI calls set it; turbo's strict environment would drop it, so turbo.json passes it on.
// Owner, 2026-10-30: "You can raise the cap and CI". Four sessions now share the self-hosted runners, so a busy
// runner pushed the checks job past its old 10-minute limit with every test passing (#241, run 41092962721).
describe('job time limits under a shared runner', () => {
  const ci = workflow('ci.yml')
  it.each(['checks', 'parity'])('ci.yml %s may run for 20 minutes', (name) => {
    expect(ci.jobs[name]?.['timeout-minutes']).toBe(20)
  })
})

describe('the load one CI job puts on the shared Mac', () => {
  const scripts = packageJson('.').scripts as Record<string, string>
  const turbo = JSON.parse(readFileSync(join(root, 'turbo.json'), 'utf8')) as {
    concurrency?: string
    globalPassThroughEnv?: string[]
  }
  const CAPPED = ['test:unit', 'test:browser', 'evidence']

  it('starts two vitest workers per project on CI, in the three root scripts that CI calls', () => {
    for (const name of CAPPED) expect(scripts[name], name).toMatch(/^VITEST_MAX_WORKERS=\S+ turbo run /)
    const ci = workflow('ci.yml')
    const calls = JSON.stringify(ci.jobs)
    for (const name of ['test:unit', 'test:browser', 'evidence']) expect(calls).toContain(`pnpm ${name}`)
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

  it('is three steps after a frozen install: the checks, the core and 2D parity suites and the 2D journeys', () => {
    expect(localSteps).toEqual([
      'pnpm install --frozen-lockfile',
      'pnpm check',
      'pnpm test:browser:core',
      'pnpm test:e2e --filter @af-examples/base-2d --filter @af-examples/examples',
    ])
  })

  it('runs in pnpm check every pnpm check the checks job runs, in the same order', () => {
    const inCheck = (scripts.check ?? '').split(' && ')
    const inCi = (ci.jobs.checks?.steps ?? [])
      .map((step) => step.run ?? '')
      .filter((run) => inCheck.includes(run))
    expect(inCheck).toEqual([
      'pnpm lint',
      'pnpm typecheck',
      'pnpm boundaries',
      'pnpm style',
      'pnpm knip',
      'pnpm test:unit:core',
    ])
    expect(inCi).toEqual(inCheck)
  })

  it('runs the same journeys as the e2e-2d job, and the same parity suites as the parity job', () => {
    const e2e = (ci.jobs['e2e-2d']?.steps ?? []).map((step) => step.run)
    expect(e2e).toContain(localSteps[3])
    const parity = (ci.jobs.parity?.steps ?? []).map((step) => step.run)
    expect(parity).toContain(localSteps[2])
  })

  it('checks base-3d’s sim folder in the root boundaries script', () => {
    expect(scripts.boundaries).toMatch(/ games\/base-3d\/src( |$)/)
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
        'pnpm knip',
        'pnpm test:unit:core',
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

  // Core-and-2D refactor, spec section 3.4 (O5): what only a release needs does not run on a pull request.
  it('leaves the release-only checks to release-checks.yml', () => {
    const runs = (ci.jobs.checks?.steps ?? []).map((step) => step.run ?? '')
    for (const releaseOnly of [
      'pnpm build',
      'pnpm build:examples',
      'pnpm build:demos',
      'pnpm api-report',
      'pnpm api-index',
      'pnpm agent-skills',
      'pnpm plugin:validate',
      'pnpm test:unit',
      'pnpm test:journeys',
    ])
      expect(runs, releaseOnly).not.toContain(releaseOnly)
    expect(runs.some((run) => run.includes('test:dist'))).toBe(false)
  })

  it('runs the 2D journeys on every ready pull request and push to main: Emberwick in Chromium and WebKit, and the examples', () => {
    const job = ci.jobs['e2e-2d']
    expect(job?.needs).toBe('checks')
    expect(job?.if).toContain('!cancelled()')
    expect(job?.if).toContain('github.event.pull_request.draft != true')
    expect(job?.if).toContain("needs.checks.outputs.docs_only != 'true'")
    expect(job?.['timeout-minutes']).toBe(30)
    const runs = (job?.steps ?? []).map((step) => step.run ?? '')
    expect(runs).toContain('pnpm test:e2e --filter @af-examples/base-2d --filter @af-examples/examples')
    expect(JSON.stringify(job?.steps)).toContain('e2e-report')
  })

  it('asks for one focused browser run by folder and Playwright arguments (test:remote), not from the PR gate', () => {
    expect(Object.keys(ci.on.workflow_dispatch?.inputs ?? {})).toEqual(['spec', 'nightly'])
    const focused = ci.jobs['e2e-focused']
    expect(focused?.if).toBe("github.event_name == 'workflow_dispatch' && inputs.spec != ''")
    const run = (focused?.steps ?? []).map((step) => step.run ?? '').join('\n')
    expect(run).toContain('cd "$folder"')
    expect(run).toContain('pnpm exec playwright test $args')
    expect(ci.jobs.e2e).toBeUndefined()
  })

  // PRODUCT.7 (PRODUCT spec §2 F5): ms/frame on the GPU runner, with the GPU to itself (AGENTS.md), compared
  // with tooling/frame-budget/budget.json, which fails closed until the first GPU-runner run sets it.
  it('runs the frame-budget probe nightly on the GPU runner, alone, and checks it against the recorded budget', () => {
    const job = ci.jobs['frame-budget']
    expect(job?.if).toContain("github.event_name == 'schedule'")
    expect(job?.if).toContain('inputs.nightly')
    expect(job?.if).toContain("inputs.spec == ''")
    expect(job?.['runs-on']).toContain('vars.AF_GPU_RUNNER')
    // Never beside a journey run (it needs no other job), and one probe at a time across runs.
    expect(job?.needs).toBeUndefined()
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
    expect(rootPackage.scripts['test:frame-budget']).toBe(
      'pnpm --filter @mcthaydt/frame-budget exec playwright test',
    )
    expect(rootPackage.scripts['budget:frame']).toBe('node tooling/frame-budget/src/check-cli.ts')
  })

  it('runs the journeys through turbo from the root; each game or example set has its own Playwright config and test:e2e', () => {
    const rootPackage = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
    expect(rootPackage.scripts['test:e2e']).toBe('turbo run test:e2e')
    for (const path of ['games/emberwick', 'games/base-3d', 'examples', 'tooling/examples-runner']) {
      expect(packageJson(path).scripts['test:e2e'], path).toBe('playwright test')
      expect(existsSync(join(root, path, 'playwright.config.ts')), path).toBe(true)
    }
    // The root has no config of its own: a run for one area never starts another area's servers.
    expect(existsSync(join(root, 'playwright.config.ts'))).toBe(false)
  })

  it('installs all three engines for the journeys: the input matrix runs cells in WebKit and Firefox (M4.10)', () => {
    const installs = [...(ci.jobs['e2e-2d']?.steps ?? []), ...(ci.jobs['e2e-focused']?.steps ?? [])]
      .map((step) => step.run ?? '')
      .filter((run) => run.includes('playwright install'))
    expect(installs.length).toBeGreaterThan(0)
    for (const install of installs) expect(install).toMatch(/chromium webkit firefox$/)
  })

  it('builds base-2d through the reusable game workflow, with the determinism check on its sim', () => {
    expect(ci.jobs['base-2d']?.uses).toBe('./.github/workflows/game-ci.yml')
    expect(ci.jobs['base-2d']?.with?.['working-directory']).toBe('games/emberwick')
    expect(ci.jobs['base-2d']?.with?.['sim-roots']).toBe('src/sim')
    expect(ci.jobs['base-2d']?.with?.runner).toBe(
      "${{ vars.AF_GAME_RUNNER || vars.AF_LINUX_RUNNER || 'af-linux' }}",
    )
  })

  // M3.7a: base-3d's sim is flat in src/ (DESIGN.md §3.1), so the whole folder is its sim root. Its game CI runs in
  // the 3D and editors workflow, not in the core and 2D gate.
  it('builds base-3d through the reusable game workflow in 3d-and-editors.yml, with the determinism check on its sim', () => {
    const job = workflow('3d-and-editors.yml').jobs['base-3d']
    expect(ci.jobs['base-3d']).toBeUndefined()
    expect(job?.uses).toBe('./.github/workflows/game-ci.yml')
    expect(job?.with?.['working-directory']).toBe('games/base-3d')
    expect(job?.with?.['sim-roots']).toBe('src')
    expect(job?.with?.runner).toBe("${{ vars.AF_GAME_RUNNER || vars.AF_LINUX_RUNNER || 'af-linux' }}")
  })

  it('gives each game-ci caller its own artifact name, since one run cannot upload two artifacts of the same name', () => {
    for (const name of ['ci.yml', '3d-and-editors.yml']) {
      const names = Object.values(workflow(name).jobs)
        .filter((job) => job.uses === './.github/workflows/game-ci.yml')
        .map((job) => job.with?.['artifact-name'] ?? 'game-dist')
      expect(names.length, name).toBeGreaterThan(0)
      expect(new Set(names).size, name).toBe(names.length)
    }
  })
})

describe('ci.yml evidence file (DX spec §3.10)', () => {
  const ci = workflow('ci.yml')
  const steps = ci.jobs.parity?.steps ?? []
  const scripts = packageJson('.').scripts as Record<string, string>
  const GOLDEN_PACKAGES = ['packages/sim', 'packages/testing', 'games/emberwick', 'games/base-3d']

  // Every workspace package with a test:evidence script, found through pnpm-workspace.yaml's own globs (what
  // `pnpm evidence` runs), so the list cannot keep a package that left (PRODUCT.5g: physics and its demo moved
  // to automata-plus) or miss one that arrived.
  const SKIPPED = new Set(['node_modules', 'dist'])
  const children = (dir: string): string[] =>
    readdirSync(join(root, dir), { withFileTypes: true })
      .filter((item) => item.isDirectory() && !SKIPPED.has(item.name) && !item.name.startsWith('.'))
      .map((item) => `${dir}/${item.name}`)
  const expand = (glob: string): string[] =>
    glob
      .split('/')
      .reduce<string[]>(
        (dirs, part) =>
          part === '*' ? dirs.flatMap(children) : dirs.map((dir) => (dir === '' ? part : `${dir}/${part}`)),
        [''],
      )
  const evidencePackages = (): string[] =>
    (parse(readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8')) as { packages: string[] }).packages
      .flatMap(expand)
      .filter((path) => existsSync(join(root, path, 'package.json')))
      .filter((path) => packageJson(path).scripts?.['test:evidence'] !== undefined)
      .sort()

  it('lists exactly the workspace packages that have a test:evidence script', () => {
    expect(evidencePackages()).toEqual([...GOLDEN_PACKAGES].sort())
  })

  it('runs every golden package’s test:evidence, then writes evidence.json from their reports', () => {
    expect(scripts.evidence).toBe(
      `${VITEST_CAP} turbo run test:evidence --concurrency=3 -- --browser.connectTimeout=120000 && node tooling/evidence/src/cli.ts`,
    )
    for (const path of GOLDEN_PACKAGES)
      expect(packageJson(path).scripts['test:evidence'], path).toMatch(
        /^vitest run (--configLoader runner )?(--project [\w-]+ )+(\S+\.test\.ts )+--reporter=default --reporter=json --outputFile\.json=\.evidence\/goldens\.json$/,
      )
  })

  it('writes the evidence file on pushes to main only, after parity passed, in the parity job', () => {
    const parity = steps.findIndex((step) => step.run === 'pnpm test:browser')
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

  // Spec section 12, veto default 9: they take seconds and catch a missing changeset before merge, not at publish.
  it('requires a changeset for a changed published package and allows only patch bumps, on every pull request', () => {
    const status = runs.indexOf('pnpm changeset status --since=origin/main')
    const patchOnly = runs.indexOf('node tooling/release/src/check-changesets.ts')
    expect(status).toBeGreaterThan(-1)
    expect(patchOnly).toBeGreaterThan(status)
    // On a push to main there is nothing to compare with: changeset status runs on pull requests only.
    expect(steps[status]?.if).toBe("github.event_name == 'pull_request'")
  })
})

describe('release-checks.yml (core-and-2D refactor spec section 3.4)', () => {
  const checks = workflow('release-checks.yml')
  const steps = checks.jobs['release-checks']?.steps ?? []
  const runs = steps.map((step) => step.run ?? '')

  it('runs before a publish, nightly and by hand, never on a pull request', () => {
    expect(Object.keys(checks.on).sort()).toEqual(['schedule', 'workflow_call', 'workflow_dispatch'])
  })

  it('builds, then runs the dist test, API report, API index, agent skills, plugin validation and consumer smoke', () => {
    const order = [
      'pnpm build:examples',
      'pnpm build:demos',
      'pnpm api-report',
      'pnpm build',
      'pnpm --filter @mcthaydt/release test:dist',
      'pnpm api-index',
      'pnpm agent-skills',
      'pnpm plugin:validate',
      'node tooling/consumer-smoke/src/run.ts --from packs',
      'pnpm --filter @mcthaydt/examples-runner test:e2e',
    ]
    expect(runs.filter((run) => order.includes(run))).toEqual(order)
  })

  it('checks out full history, so the API report can compare with origin/main', () => {
    expect(steps.find((step) => step.uses?.startsWith('actions/checkout@'))?.with?.['fetch-depth']).toBe(0)
  })

  it('runs on the AF runner label, never falling back to hosted', () => {
    const runsOn = checks.jobs['release-checks']?.['runs-on'] ?? ''
    expect(runsOn).toContain('vars.AF_LINUX_RUNNER')
    expect(runsOn).toContain("'af-linux'")
    expect(runsOn).not.toContain('ubuntu-latest')
  })
})

describe('3d-and-editors.yml (core-and-2D refactor spec section 3.4)', () => {
  const threeD = workflow('3d-and-editors.yml')

  it('runs on pull requests that touch their files or any package, on pushes to main and nightly', () => {
    expect(Object.keys(threeD.on).sort()).toEqual(['pull_request', 'push', 'schedule', 'workflow_dispatch'])
    const paths = (threeD.on.pull_request as { paths?: string[] }).paths ?? []
    expect(paths).toEqual(
      expect.arrayContaining([
        'packages/**',
        'games/base-3d/**',
        'examples/render3d/**',
        'examples/figures/**',
      ]),
    )
  })

  it('runs the 3D and editor unit, parity and journey suites and base-3d, and skips drafts', () => {
    expect(Object.keys(threeD.jobs)).toEqual(['unit-and-journeys', 'e2e-3d', 'parity-3d', 'base-3d'])
    const runs = (threeD.jobs['unit-and-journeys']?.steps ?? []).map((step) => step.run ?? '')
    expect(runs).toContain('pnpm test:unit:3d')
    expect(runs).toContain('pnpm test:journeys')
    const e2e = (threeD.jobs['e2e-3d']?.steps ?? []).map((step) => step.run ?? '')
    expect(e2e).toContain('pnpm --filter @af-games/base-3d test:e2e')
    for (const job of Object.values(threeD.jobs))
      expect(job.if).toContain('github.event.pull_request.draft != true')
  })

  it('keeps the parity container on the pinned Playwright version, as ci.yml does', () => {
    const sim = JSON.parse(readFileSync(join(root, 'packages/sim/package.json'), 'utf8'))
    expect(threeD.jobs['parity-3d']?.container?.image).toContain(
      `'mcr.microsoft.com/playwright:v${sim.devDependencies.playwright}-noble'`,
    )
  })
})

describe('repo hygiene in ci.yml and pnpm check (QB.1)', () => {
  const steps = workflow('ci.yml').jobs.checks?.steps ?? []
  const runs = steps.map((step) => step.run ?? '')
  const local = (
    JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).scripts['ci:local'] as string
  ).split(' && ')

  it.each(['pnpm knip', 'pnpm audit:deps', 'pnpm secrets'])('runs %s in CI', (command) => {
    expect(runs).toContain(command)
  })

  it('runs lint, typecheck, boundaries, style and knip in ci:local, through pnpm check', () => {
    expect(local).toContain('pnpm check')
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

  it('has exactly four jobs: plan, version, release-checks and publish', () => {
    expect(Object.keys(release.jobs)).toEqual(['plan', 'version', 'release-checks', 'publish'])
  })

  it('runs the release checks when nothing is pending, and publishes only after they pass', () => {
    const checks = release.jobs['release-checks']
    expect(checks?.uses).toBe('./.github/workflows/release-checks.yml')
    expect(checks?.if).toBe("needs.plan.outputs.pending == 'false'")
    expect(checks?.needs).toBe('plan')
    expect(publish?.needs).toEqual(['plan', 'release-checks'])
  })

  it('runs on pushes to main only, one release at a time', () => {
    expect(Object.keys(release.on)).toEqual(['push'])
    expect(JSON.stringify(release.on.push)).toContain('main')
    const parsed = parse(workflowText('release-packages.yml')) as { concurrency?: { group: string } }
    expect(parsed.concurrency?.group).toBe('release')
  })

  // Owner, 2026-10-30: "Publish from my Mac". Hosted jobs are refused on this account (a billing block since
  // 2026-10-24), so the release runs on the Owner's Mac; vars.AF_RELEASE_RUNNER moves it, and no hosted label is a
  // fallback. The publish still waits for the Owner's approval in the release environment (below).
  it("runs on the Owner's Mac, switchable by vars.AF_RELEASE_RUNNER, never on a hosted label", () => {
    for (const job of [plan, version, publish]) {
      expect(job?.['runs-on']).toBe("${{ vars.AF_RELEASE_RUNNER || 'af-mac' }}")
      expect(job?.['timeout-minutes']).toBe(20)
    }
    expect(workflowText('release-packages.yml')).not.toContain('ubuntu-')
  })

  // changesets/action writes an .npmrc into $HOME, and the Mac's runners share one home folder with every other
  // repository's jobs. Each changesets step gets a home inside the job's temp folder, which the runner empties at
  // the start and end of every job, so no token or npm setting outlives the job.
  it('gives every changesets step a home inside the job temp folder, never the runner user home', () => {
    for (const job of [version, publish]) {
      expect(changesetsIn(job)?.env?.HOME).toBe('${{ runner.temp }}/release-home')
      // The folder must exist before changesets/action writes into it.
      const steps = stepsOf(job)
      const make = steps.findIndex((each) => each.run === 'mkdir -p "$RUNNER_TEMP/release-home"')
      expect(make).toBeGreaterThanOrEqual(0)
      expect(make).toBeLessThan(steps.findIndex((each) => each.uses?.startsWith('changesets/action@')))
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
    expect(publish?.needs).toEqual(['plan', 'release-checks'])
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
  it('runs nightly and before every publish in release-checks.yml, after building the packages', () => {
    const runs = (workflow('release-checks.yml').jobs['release-checks']?.steps ?? []).map((step) => step.run)
    const build = runs.indexOf('pnpm build')
    const smoke = runs.indexOf('node tooling/consumer-smoke/src/run.ts --from packs')
    expect(build).toBeGreaterThan(-1)
    expect(smoke).toBeGreaterThan(build)
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

describe('game-release.yml itch job (PUB spec §5 flow 4)', () => {
  const release = workflow('game-release.yml')
  const itch = release.jobs.itch
  const steps = itch?.steps ?? []
  const scripts = steps.map((step) => step.run ?? '').join('\n')

  it('runs only when the caller opts in, and never on a pull request', () => {
    expect(itch?.if).toContain('inputs.itch')
    expect(itch?.if).toContain("github.event_name != 'pull_request'")
    expect(itch?.if).toContain("github.event_name != 'pull_request_target'")
    expect(release.on.workflow_call?.inputs?.itch).toMatchObject({ type: 'boolean', default: false })
  })

  it('takes BUTLER_API_KEY as a secret the caller may omit, and the itch build command as an input', () => {
    expect(release.on.workflow_call?.secrets?.BUTLER_API_KEY).toMatchObject({ required: false })
    expect(release.on.workflow_call?.inputs?.['itch-build-command']).toMatchObject({
      default: 'pnpm build:itch',
    })
  })

  it('fails closed, naming the secret, when BUTLER_API_KEY is missing: first, and never a silent skip', () => {
    const check = steps[0]
    expect(check?.env?.BUTLER_API_KEY).toBe('${{ secrets.BUTLER_API_KEY }}')
    expect(check?.run).toContain('-z "$BUTLER_API_KEY"')
    expect(check?.run).toContain('::error::BUTLER_API_KEY')
    expect(check?.run).toContain('exit 1')
    expect(check?.run).not.toContain('exit 0')
    expect(check?.run).not.toContain('::notice::')
  })

  it('builds its own itch target from the tagged commit, never the Ruken release-dist', () => {
    expect(itch?.needs).toBeUndefined()
    expect(JSON.stringify(steps)).not.toContain('release-dist')
    expect(scripts).not.toContain('automata-ship prepare --tag')
    const build = steps.find((step) => step.name === 'Build for itch.io')
    expect(build?.run).toBe('$ITCH_BUILD_COMMAND')
    expect(build?.['working-directory']).toBe('${{ inputs.working-directory }}')
    expect(itch?.env?.ITCH_BUILD_COMMAND).toBe('${{ inputs.itch-build-command }}')
  })

  it('installs a pinned butler checked against its SHA-256, and fails on any other runner', () => {
    const install = steps.find((step) => step.name?.startsWith('Install butler'))
    expect(install?.run).toContain('BUTLER_VERSION=15.32.0')
    expect(install?.run).toContain('https://broth.itch.zone/butler/')
    expect(install?.run).toContain('sha256sum -c')
    expect(install?.run).toMatch(/linux-amd64\)?[\s\S]*[0-9a-f]{64}/)
    expect(install?.run).toMatch(/darwin-arm64\)?[\s\S]*[0-9a-f]{64}/)
    expect(install?.run).toContain('GITHUB_PATH')
    expect(install?.run).toMatch(/::error::[^\n]*butler[\s\S]*exit 1/)
  })

  it('publishes with ship, the key in the environment only, after the build and butler', () => {
    const publish = steps.findIndex((step) => step.name === 'Publish to itch.io')
    const build = steps.findIndex((step) => step.name === 'Build for itch.io')
    const butler = steps.findIndex((step) => step.name?.startsWith('Install butler') ?? false)
    expect(publish).toBeGreaterThan(build)
    expect(publish).toBeGreaterThan(butler)
    expect(steps[publish]?.run).toBe('pnpm exec automata-ship publish --target itch --tag "$TAG"')
    expect(steps[publish]?.env?.BUTLER_API_KEY).toBe('${{ secrets.BUTLER_API_KEY }}')
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

  it.each(['e2e-2d', 'base-2d', 'parity'])(
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
    const classify = (
      changedFiles: readonly string[] | 'not-a-merge',
      key: 'docs_only' | 'parity_full' = 'docs_only',
    ): string => {
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
        const line = readFileSync(output, 'utf8')
          .split('\n')
          .find((each) => each.startsWith(`${key}=`))
        return line ?? `${key} missing`
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

    // Owner, 2026-10-30 ("Yes, affected-only on PRs"): a pull request runs the parity suites of the packages it
    // affects (turbo --affected, dependents included) unless it changes something outside the workspace packages,
    // where turbo cannot see what it touches (root config, workflows, vendored tarballs): then every suite runs.
    it('runs affected parity when every change is inside workspace packages or docs', () => {
      expect(classify(['packages/a/src/index.ts'], 'parity_full')).toBe('parity_full=false')
      expect(
        classify(
          [
            'tooling/x/src/run.ts',
            'examples/core/core-basic-window.ts',
            'games/emberwick/src/game.ts',
            'docs/a.md',
          ],
          'parity_full',
        ),
      ).toBe('parity_full=false')
    })

    it('runs full parity when a change is outside the workspace packages', () => {
      for (const file of [
        'package.json',
        'pnpm-lock.yaml',
        'pnpm-workspace.yaml',
        'turbo.json',
        'knip.jsonc',
        '.github/workflows/ci.yml',
        'vendor/ruken/ruken-sdk-0.0.0.tgz',
      ]) {
        expect(classify(['packages/a/src/index.ts', file], 'parity_full'), file).toBe('parity_full=true')
      }
      expect(classify('not-a-merge', 'parity_full')).toBe('parity_full=true')
    })
  })

  it('hands the parity scope to the parity job, which runs affected suites only on a pull request that allows it', () => {
    expect(ci.jobs.checks?.outputs?.parity_full).toBe('${{ steps.scope.outputs.parity_full }}')
    const steps = ci.jobs.parity?.steps ?? []
    const full = steps.find((step) => step.run === 'pnpm test:browser:core')
    const affected = steps.find((step) => step.run === 'pnpm test:browser:affected')
    expect(full?.if).toBe("github.event_name != 'pull_request' || needs.checks.outputs.parity_full == 'true'")
    expect(affected?.if).toBe(
      "github.event_name == 'pull_request' && needs.checks.outputs.parity_full != 'true'",
    )
    // The checkout is GitHub's merge commit: its first parent is the base tip, so turbo compares HEAD^1..HEAD,
    // which needs both commits in the clone.
    expect(affected?.env?.TURBO_SCM_BASE).toBe('HEAD^1')
    expect(affected?.env?.TURBO_SCM_HEAD).toBe('HEAD')
    expect(steps.find((step) => step.uses?.startsWith('actions/checkout@'))?.with?.['fetch-depth']).toBe(2)
  })
})

// DIST spec §6.4 (DIST.5c): a game's desktop bundles, built on the Owner's Linux and Mac runners. There is no Windows
// runner (coordinator, 2026-10-31), so the Windows bundle stays an Owner gate.
describe('game-release.yml: desktop bundles', () => {
  const release = workflow('game-release.yml')
  const call = release.on.workflow_call as {
    inputs: Record<string, { default?: unknown }>
    secrets: Record<string, unknown>
  }
  const scripts = (job: Job | undefined) => (job?.steps ?? []).map((step) => step.run ?? '').join('\n')

  it('is opt-in, with the build command and the runners as inputs, Linux and the Mac by default', () => {
    expect(call.inputs.desktop?.default).toBe(false)
    expect(call.inputs['desktop-build-command']?.default).toBe('pnpm build:tauri')
    expect(call.inputs['desktop-runners']?.default).toBe('["af-linux", "af-mac"]')
    expect(call.inputs['desktop-signing']?.default).toBe(false)
  })

  it('builds unsigned bundles on each runner, never for a pull request, and keeps them as an artifact', () => {
    const job = release.jobs.desktop
    expect(job?.if).toContain('inputs.desktop')
    expect(job?.if).toContain("github.event_name != 'pull_request'")
    expect(job?.['runs-on']).toBe('${{ matrix.runner }}')
    expect(scripts(job)).toContain('automata-ship prepare --target tauri --tag "$TAG"')
    const upload = job?.steps?.find((step) => step.uses?.startsWith('actions/upload-artifact@'))
    expect(upload?.with?.path).toContain('dist-tauri/')
    expect(upload?.with?.name).toContain('unsigned')
  })

  it('pushes the bundles to itch.io only when the caller asked for itch.io too', () => {
    const push = release.jobs.desktop?.steps?.find((step) => step.run?.includes('--from tauri'))
    expect(push?.if).toBe('inputs.itch')
    expect(push?.env?.BUTLER_API_KEY).toBe('${{ secrets.BUTLER_API_KEY }}')
  })

  it('signs and notarizes the macOS bundle only in the release environment, failing by name on a missing secret', () => {
    const job = release.jobs['desktop-macos-signed']
    expect(job?.if).toContain('inputs.desktop-signing')
    expect(job?.environment).toBe('release')
    expect(job?.['runs-on']).toBe('${{ inputs.desktop-macos-runner }}')
    expect(call.inputs['desktop-macos-runner']?.default).toBe('af-mac')
    const guard = scripts(job)
    for (const secret of [
      'APPLE_CERTIFICATE',
      'APPLE_CERTIFICATE_PASSWORD',
      'APPLE_SIGNING_IDENTITY',
      'APPLE_ID',
      'APPLE_PASSWORD',
      'APPLE_TEAM_ID',
    ]) {
      expect(call.secrets[secret]).toBeDefined()
      expect(guard).toContain(secret)
    }
  })
})
