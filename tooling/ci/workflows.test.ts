import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

// Test 4 (PRODUCT.5e): the shape of Plus's CI, pinned as the website's and the framework's are. The Owner,
// 2026-10-23 19:15:32Z: "Yes to a Plus repo CI workflow on af-mac, with the fork guard and the no-hosted-labels
// test." Every job runs on the Owner's Mac (label af-mac, runner af-mac-plus), never on a GitHub-hosted runner, and
// a pull request from a fork never reaches that machine.

interface Step {
  readonly uses?: string
  readonly run?: string
  readonly with?: Readonly<Record<string, unknown>>
}
interface Job {
  readonly if?: string
  readonly 'runs-on'?: unknown
  readonly steps?: Step[]
}
interface Workflow {
  readonly on: Record<string, unknown>
  readonly permissions?: Record<string, string>
  readonly jobs: Record<string, Job>
}

const dir = fileURLToPath(new URL('../../.github/workflows', import.meta.url))
const files = readdirSync(dir).filter((file) => /\.ya?ml$/.test(file))
const text = (file: string) => readFileSync(join(dir, file), 'utf8')
const workflow = (file: string) => parse(text(file)) as Workflow
const ci = workflow('ci.yml')
const jobs = (file: string) => Object.entries(workflow(file).jobs)
const steps = (job: string) => ci.jobs[job]?.steps ?? []

const FORK_GUARD =
  "github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository"

describe('every workflow', () => {
  it('includes ci.yml', () => {
    expect(files).toContain('ci.yml')
  })

  it.each(files)('%s runs every job on the Owner’s Mac (af-mac)', (file) => {
    for (const [name, job] of jobs(file)) expect(job['runs-on'], `${file}: ${name}`).toBe('af-mac')
  })

  // The no-hosted-labels test: not in runs-on, not in an expression, not in a comment that someone might copy.
  it.each(files)('%s names no GitHub-hosted runner anywhere', (file) => {
    expect(text(file)).not.toMatch(/\b(ubuntu|windows|macos)-(latest|\d)/i)
    expect(text(file)).not.toMatch(/github-hosted|runner\.environment/i)
  })

  // The fork guard: the jobs run on the Owner's own machine, so a pull request runs them only when its head is in
  // this repository. Pushes to main and manual runs have no pull request and still run.
  it.each(files)('%s guards every job against pull requests from forks', (file) => {
    for (const [name, job] of jobs(file)) expect(job.if, `${file}: ${name}`).toBe(FORK_GUARD)
  })

  it.each(files)('%s pins every action to a commit', (file) => {
    for (const [, job] of jobs(file)) {
      for (const step of job.steps ?? []) if (step.uses) expect(step.uses).toMatch(/@[0-9a-f]{40}$/)
    }
  })

  // Plus holds no secret: the framework is read with the Mac's own git credentials (the sync's plain git), and
  // the checkout token is not kept for later steps.
  it.each(files)('%s reads no secret and keeps no checkout token', (file) => {
    expect(text(file)).not.toMatch(/secrets\.|github\.token|GITHUB_TOKEN/)
    for (const [, job] of jobs(file)) {
      for (const step of job.steps ?? []) {
        if (step.uses?.startsWith('actions/checkout@')) expect(step.with?.['persist-credentials']).toBe(false)
      }
    }
  })

  it.each(files)('%s never puts event or input text into a shell script', (file) => {
    for (const [, job] of jobs(file)) {
      for (const step of job.steps ?? []) {
        expect(step.run ?? '').not.toMatch(/\$\{\{\s*(inputs|github\.event|github\.head_ref)/)
      }
    }
  })
})

describe('ci.yml', () => {
  it('runs on pushes to main, on pull requests and on request, with read-only permissions', () => {
    expect(Object.keys(ci.on).sort()).toEqual(['pull_request', 'push', 'workflow_dispatch'])
    expect(ci.on.push).toEqual({ branches: ['main'] })
    expect(ci.permissions).toEqual({ contents: 'read' })
  })

  it('checks out Plus only; the framework comes through the sync', () => {
    const checkouts = steps('checks').filter((step) => step.uses?.startsWith('actions/checkout@'))
    expect(checkouts).toHaveLength(1)
    expect(checkouts[0]?.with?.repository).toBeUndefined()
  })

  it('gives pnpm its own folder, since the Owner’s runners share one home folder', () => {
    const setup = steps('checks').find((step) => step.uses?.startsWith('pnpm/action-setup@'))
    // biome-ignore lint/suspicious/noTemplateCurlyInString: a GitHub Actions expression, not a JavaScript template
    expect(setup?.with?.dest).toBe('${{ runner.temp }}/setup-pnpm')
  })

  it('uses no cache that exists only on GitHub-hosted runners', () => {
    for (const step of steps('checks')) expect(step.with?.cache).toBeUndefined()
  })

  it('syncs core, installs and then runs the checks, in that order', () => {
    const runs = steps('checks').map((step) => step.run)
    const wanted = ['pnpm core:sync', 'pnpm install --frozen-lockfile', 'pnpm check']
    expect(runs.filter((run) => run !== undefined && wanted.includes(run))).toEqual(wanted)
  })
})
