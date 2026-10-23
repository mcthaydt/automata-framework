// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
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

  it('reads that pin, then checks the framework out beside the website with a read token', () => {
    const pinStep = steps('checks').find(step => step.run?.includes('framework.ref'))
    expect(pinStep?.id).toBe('pin')
    expect(checkout?.with?.ref).toBe('${{ steps.pin.outputs.ref }}')
    expect(checkout?.with?.path).toBe('automata-framework')
    expect(checkout?.with?.token).toBe('${{ secrets.AF_FRAMEWORK_TOKEN }}')
    expect(checkout?.with?.['fetch-depth']).toBe(0)
  })

  it('fails with a message when the token is missing, before the checkout needs it', () => {
    const index = steps('checks').findIndex(step => step.run?.includes('AF_FRAMEWORK_TOKEN'))
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

  it('does not hand the framework token to jobs that do not read the framework', () => {
    for (const job of ['browsers', 'lighthouse']) expect(JSON.stringify(workflow.jobs[job])).not.toContain('AF_FRAMEWORK_TOKEN')
  })
})

// The framework repository is private, so the first hosted runs failed in `git fetch` with only "403 Write access to
// repository not granted", which says nothing about which of the token's properties is wrong. The step before the
// checkout asks the GitHub API the same question and says what came back. The script runs here against a stub `curl`.
describe('the framework token check', () => {
  const step = steps('checks').find(candidate => candidate.name === 'AF_FRAMEWORK_TOKEN can read the framework')
  const dirs: string[] = []
  afterEach(() => { while (dirs.length) rmSync(dirs.pop()!, { recursive: true, force: true }) })

  const TOKEN = 'github_pat_11ABCDEFG0123456789_secretsecretsecretsecret'
  /** Runs the step's script with `curl` replaced by a stub that answers `status`, `body` and an expiry header. */
  function run(env: { token?: string; status?: string; body?: string; curlFails?: boolean }) {
    const dir = mkdtempSync(resolve(tmpdir(), 'token-check-'))
    dirs.push(dir)
    const curl = resolve(dir, 'curl')
    writeFileSync(curl, `#!/usr/bin/env bash
if [[ -n "$STUB_CURL_FAILS" ]]; then echo "curl: (6) Could not resolve host" >&2; exit 6; fi
while [[ $# -gt 0 ]]; do case "$1" in --output) out=$2; shift 2;; --dump-header) headers=$2; shift 2;; --header) printf '%s\\n' "$2" >> "$STUB_REQUEST"; shift 2;; *) printf '%s\\n' "$1" >> "$STUB_REQUEST"; shift;; esac; done
printf '%s' "$STUB_BODY" > "$out"
printf 'HTTP/2 %s\\r\\ngithub-authentication-token-expiration: 2026-12-01 00:00:00 UTC\\r\\n' "$STUB_STATUS" > "$headers"
printf '%s' "$STUB_STATUS"
`)
    chmodSync(curl, 0o755)
    const result = spawnSync('bash', ['-e', '-c', step!.run!], {
      encoding: 'utf8',
      env: {
        PATH: `${dir}:${process.env.PATH}`, RUNNER_TEMP: dir, STUB_REQUEST: resolve(dir, 'request'),
        AF_FRAMEWORK_TOKEN: env.token ?? TOKEN, FRAMEWORK_REF: '365f115318885708fd3b279a80784afcfdbb2ef1',
        STUB_STATUS: env.status ?? '200', STUB_BODY: env.body ?? '365f115318885708fd3b279a80784afcfdbb2ef1',
        ...(env.curlFails ? { STUB_CURL_FAILS: '1' } : {}),
      },
    })
    let request = ''
    try { request = readFileSync(resolve(dir, 'request'), 'utf8') } catch { /* curl was never reached */ }
    return { code: result.status, output: result.stdout + result.stderr, request }
  }

  it('is the step before the framework checkout, and takes the secret and the pin only as environment variables', () => {
    expect(step).toBeDefined()
    const checkout = steps('checks').find(candidate => candidate.with?.repository === 'mcthaydt/automata-framework')
    expect(steps('checks').indexOf(step!)).toBe(steps('checks').indexOf(checkout!) - 1)
    expect(step!.env).toEqual({ AF_FRAMEWORK_TOKEN: '${{ secrets.AF_FRAMEWORK_TOKEN }}', FRAMEWORK_REF: '${{ steps.pin.outputs.ref }}' })
    expect(step!.run).not.toContain('${{')
  })

  it('passes when the token can read the pinned commit', () => {
    const result = run({})
    expect(result.code).toBe(0)
    expect(result.request).toContain('https://api.github.com/repos/mcthaydt/automata-framework/commits/365f115318885708fd3b279a80784afcfdbb2ef1')
    expect(result.request).toContain(`Authorization: Bearer ${TOKEN}`)
  })

  it('says the secret is missing when it is empty', () => {
    const result = run({ token: '' })
    expect(result.code).toBe(1)
    expect(result.output).toContain('AF_FRAMEWORK_TOKEN is missing')
    expect(result.request).toBe('')
  })

  it('reports the status, GitHub’s message, the kind of token and its expiry when the token is refused', () => {
    const result = run({ status: '403', body: '{"message":"Resource not accessible by personal access token","status":"403"}' })
    expect(result.code).toBe(1)
    expect(result.output).toContain('::error::')
    expect(result.output).toContain('HTTP 403')
    expect(result.output).toContain('Resource not accessible by personal access token')
    expect(result.output).toContain('fine-grained personal access token')
    expect(result.output).toContain('2026-12-01 00:00:00 UTC')
  })

  it('names the other kinds of token it can tell apart', () => {
    expect(run({ token: 'ghp_abc', status: '404', body: '{"message":"Not Found"}' }).output).toContain('classic personal access token')
    expect(run({ token: 'ghs_abc', status: '403', body: '{}' }).output).toContain('installation token')
    expect(run({ token: 'abc', status: '403', body: '{}' }).output).toContain('token of a kind this check does not recognise')
  })

  it('fails when GitHub cannot be reached, with the status 000', () => {
    const result = run({ curlFails: true })
    expect(result.code).toBe(1)
    expect(result.output).toContain('HTTP 000')
  })

  it('never prints the token', () => {
    for (const scenario of [{ status: '403', body: '{"message":"x"}' }, { token: '' }, { curlFails: true }, {}]) {
      expect(run(scenario).output).not.toContain(TOKEN)
    }
    expect(step!.run).not.toMatch(/(echo|printf)[^\n]*\$\{?AF_FRAMEWORK_TOKEN/)
  })
})
