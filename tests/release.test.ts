// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { releaseManifest } from '../scripts/release'

// DX.12: a release is the exact build CI tested, named by its content. Until the Owner supplies the host, the
// release script only plans one (`--dry-run`); without the flag it refuses rather than upload anywhere.

const root = resolve(import.meta.dirname, '..')
const dirs: string[] = []
afterAll(() => { for (const dir of dirs) rmSync(dir, { recursive: true, force: true }) })

function tree(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'release-'))
  dirs.push(dir)
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  return dir
}
const sha256 = (text: string) => createHash('sha256').update(text).digest('hex')
const release = (dir: string, ...flags: string[]) =>
  spawnSync(process.execPath, ['--import', 'tsx', 'scripts/release.ts', dir, ...flags], { cwd: root, encoding: 'utf8' })

describe('releaseManifest', () => {
  it('lists every file, sorted by path, with its bytes and sha256', () => {
    const dir = tree({ 'index.html': '<p>home</p>', '_app/a.js': 'a', 'llms.txt': 'llms' })
    expect(releaseManifest(dir).files).toEqual([
      { path: '_app/a.js', bytes: 1, sha256: sha256('a') },
      { path: 'index.html', bytes: 11, sha256: sha256('<p>home</p>') },
      { path: 'llms.txt', bytes: 4, sha256: sha256('llms') },
    ])
  })

  it('names the release by its content: the same tree is the same id, one changed byte is a new one', () => {
    const files = { 'index.html': '<p>home</p>', 'llms.txt': 'llms' }
    const id = releaseManifest(tree(files)).id
    expect(id).toMatch(/^[0-9a-f]{64}$/)
    expect(releaseManifest(tree(files)).id).toBe(id)
    expect(releaseManifest(tree({ ...files, 'llms.txt': 'llmz' })).id).not.toBe(id)
  })
})

describe('pnpm release', () => {
  it('refuses to publish without --dry-run, naming what the Owner must supply, and writes nothing', () => {
    const dir = tree({ 'index.html': 'x' })
    const out = join(dir, 'release-manifest.json')
    const result = release(dir, '--out', out)
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('No deploy target is configured')
    expect(result.stderr).toContain('hosting account, a deploy credential and DNS for automata.ruken.com')
    expect(existsSync(out)).toBe(false)
  })

  it('with --dry-run writes the manifest and says nothing was uploaded', () => {
    const dir = tree({ 'index.html': 'x', 'llms.txt': 'llms' })
    const out = join(dir, '..', `${dir.split('/').at(-1)}-manifest.json`)
    dirs.push(out)
    const result = release(dir, '--dry-run', '--out', out)
    expect(result.stderr).toBe('')
    expect(result.status).toBe(0)
    const manifest = JSON.parse(readFileSync(out, 'utf8')) as ReturnType<typeof releaseManifest> & { target: string }
    expect(manifest.id).toBe(releaseManifest(dir).id)
    expect(manifest.target).toBe('placeholder')
    expect(result.stdout).toContain(`Dry run: release ${manifest.id.slice(0, 12)}, 2 files, 5 bytes, for the placeholder target`)
    expect(result.stdout).toContain('nothing was uploaded')
  })
})
