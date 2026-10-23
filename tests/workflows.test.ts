// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

// QB.3f: the website's CI is part of its quality bar, so its shape is pinned here the way the framework pins its own
// (packages/ship/src/workflows.test.ts): what runs on every change, where the framework checkout comes from, and
// that nothing in it can be steered by a pull request's text.

interface Step {
  readonly id?: string
  readonly uses?: string
  readonly run?: string
  readonly name?: string
  readonly if?: string
  readonly env?: Record<string, string>
  readonly with?: Readonly<Record<string, string | undefined>>
  readonly 'working-directory'?: string
}
interface Job {
  readonly 'runs-on'?: string
  readonly needs?: string | string[]
  readonly container?: { image: string }
  readonly steps?: Step[]
}
interface Workflow {
  readonly on: Record<string, unknown>
  readonly permissions?: Record<string, string>
  readonly jobs: Record<string, Job>
}

const root = resolve(import.meta.dirname, '..')
const read = (path: string): string => readFileSync(resolve(root, path), 'utf8')
const workflow = parse(read('.github/workflows/ci.yml')) as Workflow
const steps = (job: string): Step[] => workflow.jobs[job]?.steps ?? []
const runs = (job: string): string[] => steps(job).map(step => step.run ?? '')

describe('ci.yml', () => {
  it('runs on pushes to main, on pull requests and on request, with read-only permissions', () => {
    expect(Object.keys(workflow.on).sort()).toEqual(['pull_request', 'push', 'workflow_dispatch'])
    expect(workflow.permissions).toEqual({ contents: 'read' })
  })

  it('has the three jobs the quality bar needs', () => {
    expect(Object.keys(workflow.jobs)).toEqual(['checks', 'browsers', 'lighthouse'])
  })

  // Coordinator decision 2026-10-23: this repository's CI runs on GitHub-hosted Ubuntu, which keeps the shared self-hosted
  // runner free for Ruken and needs no runner registered here. The Ubuntu release is pinned (not `ubuntu-latest`) so a
  // runner image change cannot move the build; it is the release the pinned Playwright image is built on (noble).
  it('runs every job on one pinned GitHub-hosted Ubuntu release, not a self-hosted runner', () => {
    for (const [name, job] of Object.entries(workflow.jobs)) {
      expect(job['runs-on'], name).toBe('ubuntu-24.04')
    }
  })

  it('keeps the browser jobs in the Playwright image built on that Ubuntu release', () => {
    for (const name of ['browsers', 'lighthouse']) expect(workflow.jobs[name]?.container?.image, name).toMatch(/-noble$/)
  })

  it('pins every third-party action to a commit', () => {
    for (const job of Object.values(workflow.jobs)) {
      for (const step of job.steps ?? []) if (step.uses) expect(step.uses).toMatch(/@[0-9a-f]{40}(\s|$)/)
    }
  })

  it('never puts event or input text straight into a shell script', () => {
    for (const job of Object.keys(workflow.jobs)) {
      for (const script of runs(job)) expect(script).not.toMatch(/\$\{\{\s*(inputs|github\.event|github\.head_ref)/)
    }
  })

  it('never keeps the checkout token for later steps', () => {
    for (const job of Object.values(workflow.jobs)) {
      for (const step of job.steps ?? []) {
        if (step.uses?.startsWith('actions/checkout@')) expect(step.with?.['persist-credentials']).toBe(false)
      }
    }
  })
})

describe('the framework checkout', () => {
  const pin = read('framework.ref').trim()
  const checkout = steps('checks').find(step => step.with?.repository === 'mcthaydt/automata-framework')

  it('is pinned to a full commit in framework.ref', () => {
    expect(pin).toMatch(/^[0-9a-f]{40}$/)
  })

  it('reads that pin, then checks the framework out beside the website with a read-only deploy key', () => {
    const pinStep = steps('checks').find(step => step.run?.includes('framework.ref'))
    expect(pinStep?.id).toBe('pin')
    expect(checkout?.with?.ref).toBe('${{ steps.pin.outputs.ref }}')
    expect(checkout?.with?.path).toBe('automata-framework')
    expect(checkout?.with?.['ssh-key']).toBe('${{ secrets.AF_FRAMEWORK_DEPLOY_KEY }}')
    expect(checkout?.with?.token).toBeUndefined()
    expect(checkout?.with?.['fetch-depth']).toBe(0)
  })

  it('fails with a message when the key is missing, before the checkout needs it', () => {
    const index = steps('checks').findIndex(step => step.run?.includes('AF_FRAMEWORK_DEPLOY_KEY'))
    expect(index).toBeGreaterThanOrEqual(0)
    expect(index).toBeLessThan(steps('checks').indexOf(checkout!))
  })

  it('installs the framework without running its install scripts', () => {
    const install = steps('checks').find(step => step['working-directory'] === 'automata-framework' && step.run?.startsWith('pnpm install'))
    expect(install?.run).toBe('pnpm install --frozen-lockfile --ignore-scripts')
  })
})

describe('the jobs', () => {
  it('checks runs svelte-check, the build, check:site and the unit tests, in that order', () => {
    const wanted = ['pnpm check', 'pnpm build', 'pnpm check:site', 'pnpm test']
    const commands = runs('checks').filter(run => wanted.includes(run))
    expect(commands).toEqual(wanted)
  })

  it('checks hands the build to the other jobs, which test that artifact', () => {
    expect(steps('checks').some(step => step.uses?.startsWith('actions/upload-artifact@') && step.with?.name === 'site-build')).toBe(true)
    for (const job of ['browsers', 'lighthouse']) {
      expect(workflow.jobs[job]?.needs, job).toBe('checks')
      expect(steps(job).some(step => step.uses?.startsWith('actions/download-artifact@') && step.with?.name === 'site-build'), job).toBe(true)
    }
  })

  it('browsers runs the Chromium and WebKit suite in the Playwright image that matches the pinned version', () => {
    const version = JSON.parse(read('package.json')).devDependencies['@playwright/test'] as string
    expect(workflow.jobs.browsers?.container?.image).toBe(`mcr.microsoft.com/playwright:v${version}-noble`)
    expect(runs('browsers')).toContain('pnpm test:e2e')
  })

  it('browsers and lighthouse keep their reports, also when they fail', () => {
    for (const [job, name] of [['browsers', 'playwright-report'], ['lighthouse', 'lighthouse-report']] as const) {
      const upload = steps(job).find(step => step.uses?.startsWith('actions/upload-artifact@'))
      expect(upload?.if, job).toBe('always()')
      expect(upload?.with?.name, job).toBe(name)
    }
  })

  it('lighthouse runs the budget with the image’s own Chromium', () => {
    expect(runs('lighthouse')).toContain('pnpm lighthouse')
    const withChrome = steps('lighthouse').find(step => step.run === 'pnpm lighthouse')
    expect(withChrome?.env?.CHROME_PATH).toBeDefined()
  })

  it('does not hand the framework key to jobs that do not read the framework', () => {
    for (const job of ['browsers', 'lighthouse']) expect(JSON.stringify(workflow.jobs[job])).not.toContain('AF_FRAMEWORK')
  })

  it('no longer uses the personal access token that could not see the framework', () => {
    expect(read('.github/workflows/ci.yml')).not.toContain('AF_FRAMEWORK_TOKEN')
  })
})

// The framework repository is private. The first hosted runs used a personal access token as the checkout's `token` and
// failed in `git fetch` with only "403 Write access to repository not granted"; the diagnostic that followed showed the
// token could not see the repository at all (HTTP 404). A read-only deploy key of that one repository replaced it. A
// missing or wrong secret would otherwise surface as an ssh error in the middle of the checkout, so the step before it
// says which secret to fix. The script runs here with the secret as an environment variable.
describe('the framework deploy key check', () => {
  const step = steps('checks').find(candidate => candidate.name === 'AF_FRAMEWORK_DEPLOY_KEY holds a private key')
  const KEY = '-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaC1rZXktdjEAAAAAsecretsecretsecret\n-----END OPENSSH PRIVATE KEY-----\n'

  function run(key: string) {
    const result = spawnSync('bash', ['-e', '-c', step!.run!], { encoding: 'utf8', env: { PATH: process.env.PATH, AF_FRAMEWORK_DEPLOY_KEY: key } })
    return { code: result.status, output: result.stdout + result.stderr }
  }

  it('is the step before the framework checkout, and takes the secret only as an environment variable', () => {
    expect(step).toBeDefined()
    const checkout = steps('checks').find(candidate => candidate.with?.repository === 'mcthaydt/automata-framework')
    expect(steps('checks').indexOf(step!)).toBe(steps('checks').indexOf(checkout!) - 1)
    expect(step!.env).toEqual({ AF_FRAMEWORK_DEPLOY_KEY: '${{ secrets.AF_FRAMEWORK_DEPLOY_KEY }}' })
    expect(step!.run).not.toContain('${{')
  })

  it('passes when the secret is an OpenSSH private key', () => {
    expect(run(KEY).code).toBe(0)
  })

  it('says the secret is missing when it is empty', () => {
    const result = run('')
    expect(result.code).toBe(1)
    expect(result.output).toContain('::error::AF_FRAMEWORK_DEPLOY_KEY is missing')
  })

  it('says what the secret holds instead when it is not a private key, such as the public half or a token', () => {
    for (const wrong of ['ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIsecret automata_website CI', 'github_pat_11ABCDEFG0123456789_secretsecret']) {
      const result = run(wrong)
      expect(result.code).toBe(1)
      expect(result.output).toContain('::error::AF_FRAMEWORK_DEPLOY_KEY does not hold a private key')
    }
  })

  it('never prints the secret', () => {
    const PRIVATE_LINE = 'b3BlbnNzaC1rZXktdjEAAAAAsecretsecretsecret'
    for (const value of [KEY, '', 'ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIsecretsecret', 'github_pat_11ABCDEFG0123456789_secretsecret']) {
      const output = run(value).output
      expect(output).not.toContain(PRIVATE_LINE)
      expect(output).not.toContain('secretsecret')
    }
    expect(step!.run).not.toMatch(/(echo|printf)[^\n]*\$\{?AF_FRAMEWORK_DEPLOY_KEY/)
  })
})
