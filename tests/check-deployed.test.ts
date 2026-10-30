// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { checkServedFiles } from '../scripts/check-deployed'

// DX.12's served-file check (DX spec, D-DX-5): /llms.txt and /llms-full.txt come from the origin as the build wrote
// them. The URL-based instructions for AI tools (DX.10d) point at these files, so a stale or missing copy is a failure.

const root = resolve(import.meta.dirname, '..')
const build = mkdtempSync(join(tmpdir(), 'check-deployed-'))
writeFileSync(join(build, 'llms.txt'), '# Automata\n')
writeFileSync(join(build, 'llms-full.txt'), '# Automata, in full\n')
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

describe('pnpm check:deployed --local', () => {
  it('serves the build with serve-static on a free port and passes', () => {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/check-deployed.ts', '--local', '--build', build], { cwd: root, encoding: 'utf8', timeout: 30_000 })
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    expect(result.stdout).toMatch(/^\/llms\.txt and \/llms-full\.txt are served from http:\/\/127\.0\.0\.1:\d+ as built\.\n$/)
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
