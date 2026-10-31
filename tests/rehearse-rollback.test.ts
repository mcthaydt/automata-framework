// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { releaseManifest, type ReleaseRecord } from '../scripts/release'
import { withContentSecurityPolicy } from '../src/lib/csp'

// QB.4c: the rollback rehearsal. It publishes the build (A) and then A plus one marker file (B) to a local release store,
// checks the served site is B, rolls back, and checks the served site is A again, with check:deployed's served-file,
// header and page-policy checks each time. Until the Owner supplies the host the local store is the only one.

const root = resolve(import.meta.dirname, '..')
const build = mkdtempSync(join(tmpdir(), 'rehearse-'))
const store = mkdtempSync(join(tmpdir(), 'rehearse-store-'))
writeFileSync(join(build, 'llms.txt'), '# Automata\n')
writeFileSync(join(build, 'llms-full.txt'), '# Automata, in full\n')
const PAGE = withContentSecurityPolicy('<!doctype html><html lang="en"><head><title>x</title></head><body><script>start()</script></body></html>')
writeFileSync(join(build, 'index.html'), PAGE)
writeFileSync(join(build, 'docs.html'), PAGE)
afterAll(() => { for (const dir of [build, store]) rmSync(dir, { recursive: true, force: true }) })

const rehearse = (...args: string[]) =>
  spawnSync(process.execPath, ['--import', 'tsx', 'scripts/rehearse-rollback.ts', ...args], { cwd: root, encoding: 'utf8', timeout: 60_000 })

describe('pnpm rehearse:rollback', () => {
  it('publishes A then B, serves B, rolls back, and serves A again', () => {
    const result = rehearse(build, '--store', store)
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    const a = releaseManifest(build).id
    const history = JSON.parse(readFileSync(join(store, 'history.json'), 'utf8')) as ReleaseRecord[]
    expect(history.map(record => record.action)).toEqual(['publish', 'publish', 'rollback'])
    expect(history[0]!.id).toBe(a)
    const b = history[1]!.id
    expect(b).not.toBe(a)
    expect(history[2]).toMatchObject({ action: 'rollback', id: a, from: b })
    expect(readFileSync(join(store, 'current'), 'utf8').trim()).toBe(a)
    expect(result.stdout).toContain(`Serving B (${b.slice(0, 12)}): check:deployed passed, the marker is served.`)
    expect(result.stdout).toContain(`Rolled back to A (${a.slice(0, 12)}): check:deployed passed, the marker is gone.`)
  })

  it('fails, naming the problem, when the build would not pass check:deployed', () => {
    const broken = mkdtempSync(join(tmpdir(), 'rehearse-broken-'))
    try {
      writeFileSync(join(broken, 'index.html'), '<p>no llms files</p>')
      const result = rehearse(broken, '--store', join(broken, '..', `${broken.split('/').at(-1)}-store`))
      expect(result.status).toBe(1)
      expect(result.stderr).toContain('/llms.txt: the build has no such file')
    } finally {
      rmSync(broken, { recursive: true, force: true })
      rmSync(join(broken, '..', `${broken.split('/').at(-1)}-store`), { recursive: true, force: true })
    }
  })
})
