// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { checkHeaders, checkServedFiles, checkServedPolicies } from '../scripts/check-deployed'
import { withContentSecurityPolicy } from '../src/lib/csp'
import { securityHeaders } from '../src/lib/security-headers'

// DX.12's served-file check (DX spec, D-DX-5): /llms.txt and /llms-full.txt come from the origin as the build wrote
// them. The URL-based instructions for AI tools (DX.10d) point at these files, so a stale or missing copy is a failure.

const root = resolve(import.meta.dirname, '..')
const build = mkdtempSync(join(tmpdir(), 'check-deployed-'))
writeFileSync(join(build, 'llms.txt'), '# Automata\n')
writeFileSync(join(build, 'llms-full.txt'), '# Automata, in full\n')
const PAGE = withContentSecurityPolicy('<!doctype html><html lang="en"><head><title>x</title></head><body><script>start()</script></body></html>')
writeFileSync(join(build, 'index.html'), PAGE)
writeFileSync(join(build, 'docs.html'), PAGE)
afterAll(() => rmSync(build, { recursive: true, force: true }))

const ORIGIN = 'https://site.example'
type Answer = { status?: number; type?: string; body?: string }
const fakeFetch = (answers: Record<string, Answer>) => async (url: string) => {
  const path = new URL(url).pathname
  const answer = answers[path] ?? {}
  return new Response(answer.body ?? '', { status: answer.status ?? 200, headers: { 'content-type': answer.type ?? 'text/plain; charset=utf-8' } })
}
const served = { '/llms.txt': { body: '# Automata\n' }, '/llms-full.txt': { body: '# Automata, in full\n' } }

describe('checkServedFiles', () => {
  it('passes when both files are served as text with the bytes the build wrote', async () => {
    expect(await checkServedFiles(ORIGIN, build, fakeFetch(served))).toEqual([])
  })

  it('reports a missing file, a non-text type and stale bytes, each by its path', async () => {
    expect(await checkServedFiles(ORIGIN, build, fakeFetch({ ...served, '/llms.txt': { status: 404, body: 'gone' } }))).toEqual([
      '/llms.txt: status 404, expected 200',
    ])
    expect(await checkServedFiles(ORIGIN, build, fakeFetch({ ...served, '/llms-full.txt': { type: 'text/html', body: '# Automata, in full\n' } }))).toEqual([
      '/llms-full.txt: content-type text/html, expected text/plain',
    ])
    expect(await checkServedFiles(ORIGIN, build, fakeFetch({ ...served, '/llms.txt': { body: '# Old\n' } }))).toEqual([
      '/llms.txt: the served bytes differ from the build',
    ])
  })

  it('reports an origin it cannot reach', async () => {
    const unreachable = async () => { throw new TypeError('fetch failed') }
    expect(await checkServedFiles(ORIGIN, build, unreachable)).toEqual(['/llms.txt: fetch failed', '/llms-full.txt: fetch failed'])
  })
})

// QB.4a: the header set (src/lib/security-headers.ts) read back from the origin, on a page and on a text file.
describe('checkHeaders', () => {
  const withHeaders = (headers: (path: string) => Record<string, string>) => async (url: string) =>
    new Response('', { status: 200, headers: headers(new URL(url).pathname) })

  it('passes when every path answers with its set, the demos with their own policy', async () => {
    expect(await checkHeaders(ORIGIN, ['/', '/llms.txt', '/demos/'], withHeaders(securityHeaders))).toEqual([])
    expect(await checkHeaders(ORIGIN, ['/demos/'], withHeaders(() => securityHeaders('/')))).toEqual([
      `/demos/: Content-Security-Policy is "frame-ancestors 'self'", expected "${securityHeaders('/demos/')['Content-Security-Policy']}"`,
    ])
  })

  it('reports a missing or different header by path and name', async () => {
    const { 'X-Content-Type-Options': _dropped, ...rest } = securityHeaders('/')
    const weaker = { ...rest, 'Strict-Transport-Security': 'max-age=60' }
    expect(await checkHeaders(ORIGIN, ['/'], withHeaders(() => weaker))).toEqual([
      '/: Strict-Transport-Security is "max-age=60", expected "max-age=86400; includeSubDomains"',
      '/: X-Content-Type-Options is missing, expected "nosniff"',
    ])
  })
})

// QB-d: the page policy is checked on the HTML the origin serves, so a host or CDN that rewrites a page's inline script
// (minifying, injecting analytics) and so breaks its hash fails the check, though the build passed check:site.
describe('checkServedPolicies', () => {
  const serving = (html: string) => async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } })

  it('passes a served page whose policy allows its scripts', async () => {
    expect(await checkServedPolicies(ORIGIN, ['/'], serving(PAGE))).toEqual([])
  })

  it('reports a page whose script the host rewrote, and a page with no policy', async () => {
    expect(await checkServedPolicies(ORIGIN, ['/'], serving(PAGE.replace('start()', 'start();analytics()')))).toEqual([
      '/: an inline script is not allowed by the page’s Content-Security-Policy (its sha256 is not in script-src), so the browser will refuse to run it',
    ])
    expect((await checkServedPolicies(ORIGIN, ['/docs'], serving('<!doctype html><html><head></head><body></body></html>')))[0]).toMatch(/^\/docs: has no Content-Security-Policy/)
  })
})

describe('pnpm check:deployed --local', () => {
  it('serves the build with serve-static on a free port and passes', () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/check-deployed.ts', '--local', '--build', build], { cwd: root, encoding: 'utf8', timeout: 30_000 })
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/^\/llms\.txt and \/llms-full\.txt are served from http:\/\/127\.0\.0\.1:\d+ as built, with the security headers on \/, \/llms\.txt, \/demos\/ and \/no-such-page and the page policy on \/ and \/docs\.\n$/)
  })

  it('refuses both an origin and --local, and neither', () => {
    for (const args of [['http://127.0.0.1:9', '--local'], []]) {
      const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/check-deployed.ts', ...args, '--build', build], { cwd: root, encoding: 'utf8', timeout: 30_000 })
      expect(result.status, args.join(' ')).toBe(2)
      expect(result.stderr).toContain('Usage: check-deployed.ts <origin> | --local')
    }
  })

  it('fails with the problems when an origin does not serve them', () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/check-deployed.ts', 'http://127.0.0.1:9', '--build', build], { cwd: root, encoding: 'utf8', timeout: 30_000 })
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('/llms.txt: fetch failed')
  })

  it('checks an origin given alone, against ./build', () => {
    // ./build may or may not exist here; either way the origin is checked, not the usage refused.
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/check-deployed.ts', 'http://127.0.0.1:9'], { cwd: root, encoding: 'utf8', timeout: 30_000 })
    expect(result.status).toBe(1)
    expect(result.stderr).toMatch(/^\/llms\.txt: /)
  })
})

describe('checkServedFiles and the build', () => {
  it('reports a file the build lacks as a problem, not a crash', async () => {
    const empty = mkdtempSync(join(tmpdir(), 'check-deployed-empty-'))
    try {
      const problems = await checkServedFiles(ORIGIN, empty, fakeFetch(served))
      expect(problems).toHaveLength(2)
      expect(problems[0]).toMatch(/^\/llms\.txt: the build has no such file/)
    } finally {
      rmSync(empty, { recursive: true, force: true })
    }
  })
})
