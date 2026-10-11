import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

// The workflows are part of the ship lane's contract (ship spec §3.7): what runs on every push, what runs
// only nightly or on request, and how a game's repository reuses them. These tests pin that shape.

const root = fileURLToPath(new URL('../../..', import.meta.url))
const workflowText = (name: string): string => readFileSync(join(root, '.github/workflows', name), 'utf8')

interface Step {
  readonly uses?: string
  readonly run?: string
  readonly name?: string
  readonly if?: string
  readonly env?: Record<string, string>
}
interface Job {
  readonly 'runs-on'?: string
  readonly if?: string
  readonly needs?: string | string[]
  readonly uses?: string
  readonly with?: Record<string, unknown>
  readonly container?: { image: string }
  readonly steps?: Step[]
}
interface Workflow {
  readonly on: Record<string, { inputs?: Record<string, unknown>; secrets?: Record<string, unknown> } | null>
  readonly permissions?: Record<string, string>
  readonly jobs: Record<string, Job>
}
const workflow = (name: string): Workflow => parse(workflowText(name)) as Workflow
const ALL = ['ci.yml', 'game-ci.yml', 'game-release.yml']

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

  it.each(ALL)('%s reads the repository and nothing more by default', (name) => {
    expect(workflow(name).permissions).toEqual({ contents: 'read' })
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
    expect(JSON.stringify(ci.jobs.parity?.steps)).toContain('--project browsers')
  })

  it('keeps the parity container on the pinned Playwright version', () => {
    const sim = JSON.parse(readFileSync(join(root, 'packages/sim/package.json'), 'utf8'))
    expect(ci.jobs.parity?.container?.image).toBe(
      `mcr.microsoft.com/playwright:v${sim.devDependencies.playwright}-noble`,
    )
  })

  it('runs browser journeys only nightly or on request, focused by spec (test:remote)', () => {
    expect(Object.keys(ci.on.workflow_dispatch?.inputs ?? {})).toEqual(['spec', 'nightly'])
    const e2e = ci.jobs.e2e
    expect(e2e?.if).toContain("github.event_name == 'schedule'")
    expect(e2e?.if).toContain("github.event_name == 'workflow_dispatch'")
    expect(e2e?.['runs-on']).toContain('vars.AF_GPU_RUNNER')
    expect(JSON.stringify(e2e?.steps)).toContain('e2e-report')
  })

  it('builds the placeholder through the reusable game workflow', () => {
    expect(ci.jobs.placeholder?.uses).toBe('./.github/workflows/game-ci.yml')
    expect(ci.jobs.placeholder?.with?.['working-directory']).toBe('examples/placeholder')
  })
})

describe('game-ci.yml (reusable)', () => {
  const gameCi = workflow('game-ci.yml')

  it("is called by a game's own ci.yml with its folder, its sim sources and the AF ref", () => {
    expect(Object.keys(gameCi.on)).toEqual(['workflow_call'])
    expect(Object.keys(gameCi.on.workflow_call?.inputs ?? {})).toEqual(
      expect.arrayContaining(['working-directory', 'sim-roots', 'af-ref']),
    )
  })

  it("runs the determinism checker on the game's sim sources (shared contracts §2), then prepares the build", () => {
    const scripts = (gameCi.jobs.game?.steps ?? []).map((step) => step.run ?? '').join('\n')
    expect(scripts).toContain('tooling/check-boundaries/src/cli.ts')
    expect(scripts).toContain('packages/ship/src/cli.ts" prepare')
    expect(scripts.indexOf('check-boundaries')).toBeLessThan(scripts.indexOf('prepare'))
  })
})

describe('game-release.yml (reusable)', () => {
  const release = workflow('game-release.yml')

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
