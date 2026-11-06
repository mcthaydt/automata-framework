// @vitest-environment node
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { currentRelease, publishRelease, releaseManifest, rollBack, type ReleaseRecord } from '../scripts/release'

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

  it('reads the build folder given first, with no other option before it', () => {
    // With no --out the manifest goes to ./release-manifest.json (git-ignored), here the repository root's.
    const dir = tree({ 'a.txt': 'a' })
    const out = join(root, 'release-manifest.json')
    const before = existsSync(out) ? readFileSync(out) : undefined
    try {
      const result = release(dir, '--dry-run')
      expect(result.status).toBe(0)
      expect((JSON.parse(readFileSync(out, 'utf8')) as { id: string }).id).toBe(releaseManifest(dir).id)
    } finally {
      if (before) writeFileSync(out, before)
      else rmSync(out, { force: true })
    }
  })

  it('refuses an option without its value', () => {
    const result = release(tree({ 'a.txt': 'a' }), '--dry-run', '--out')
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain("Option '--out <value>' argument missing")
  })
})

// QB.4c: a release store laid out the way an immutable host keeps releases. Each release sits in its own folder under its
// id, a history records what was made current and when, and rolling back moves the current pointer to an earlier
// release without rebuilding or changing a file.
describe('the release store', () => {
  const store = () => { const dir = mkdtempSync(join(tmpdir(), 'store-')); dirs.push(dir); return dir }
  const history = (dir: string) => JSON.parse(readFileSync(join(dir, 'history.json'), 'utf8')) as ReleaseRecord[]
  const a = () => tree({ 'index.html': '<p>a</p>', 'llms.txt': 'a' })
  const b = () => tree({ 'index.html': '<p>b</p>', 'llms.txt': 'b' })

  it('publishes a build under its id, records it and makes it current', () => {
    const dir = store()
    const build = a()
    const record = publishRelease(build, dir, '2026-10-31T07:00:00Z')
    const id = releaseManifest(build).id
    expect(record).toEqual({ action: 'publish', id, at: '2026-10-31T07:00:00Z' })
    expect(readFileSync(join(dir, 'releases', id, 'index.html'), 'utf8')).toBe('<p>a</p>')
    expect(releaseManifest(join(dir, 'releases', id)).id).toBe(id)
    expect(currentRelease(dir)).toBe(id)
    expect(history(dir)).toEqual([record])
  })

  it('never changes a published release: the same build again is a new history entry, not a new copy', () => {
    const dir = store()
    const build = a()
    const id = publishRelease(build, dir, '2026-10-31T07:00:00Z').id
    const copied = statSync(join(dir, 'releases', id, 'index.html')).mtimeMs
    publishRelease(build, dir, '2026-10-31T07:05:00Z')
    expect(statSync(join(dir, 'releases', id, 'index.html')).mtimeMs).toBe(copied)
    expect(readdirSync(join(dir, 'releases'))).toEqual([id])
    expect(history(dir).map(entry => entry.at)).toEqual(['2026-10-31T07:00:00Z', '2026-10-31T07:05:00Z'])
  })

  it('rolls back to the release that was current before, and records where it came from', () => {
    const dir = store()
    const first = publishRelease(a(), dir, '2026-10-31T07:00:00Z').id
    const second = publishRelease(b(), dir, '2026-10-31T07:05:00Z').id
    const record = rollBack(dir, '2026-10-31T07:10:00Z')
    expect(record).toEqual({ action: 'rollback', id: first, from: second, at: '2026-10-31T07:10:00Z' })
    expect(currentRelease(dir)).toBe(first)
    expect(history(dir).at(-1)).toEqual(record)
    // Both releases are still there, unchanged: rolling forward again is another rollback, by name.
    expect(readdirSync(join(dir, 'releases')).sort()).toEqual([first, second].sort())
    expect(rollBack(dir, '2026-10-31T07:15:00Z', second)).toEqual({ action: 'rollback', id: second, from: first, at: '2026-10-31T07:15:00Z' })
  })

  it('skips releases that were current only because the same build was published twice in a row', () => {
    const dir = store()
    const first = publishRelease(a(), dir, '2026-10-31T07:00:00Z').id
    const buildB = b()
    publishRelease(buildB, dir, '2026-10-31T07:05:00Z')
    publishRelease(buildB, dir, '2026-10-31T07:06:00Z')
    expect(rollBack(dir, '2026-10-31T07:10:00Z').id).toBe(first)
  })

  it('refuses with no earlier release, an unknown release or the current one, and changes nothing', () => {
    const dir = store()
    const only = publishRelease(a(), dir, '2026-10-31T07:00:00Z').id
    const before = readFileSync(join(dir, 'history.json'), 'utf8')
    expect(() => rollBack(dir, '2026-10-31T07:10:00Z')).toThrow('No earlier release to roll back to')
    expect(() => rollBack(dir, '2026-10-31T07:10:00Z', 'f'.repeat(64))).toThrow('No published release ffffffffffff')
    expect(() => rollBack(dir, '2026-10-31T07:10:00Z', only)).toThrow(`Release ${only.slice(0, 12)} is already current`)
    expect(() => rollBack(store(), '2026-10-31T07:10:00Z')).toThrow('No release is current')
    expect(readFileSync(join(dir, 'history.json'), 'utf8')).toBe(before)
    expect(currentRelease(dir)).toBe(only)
  })
})

describe('pnpm release with a store', () => {
  const store = () => { const dir = mkdtempSync(join(tmpdir(), 'store-')); dirs.push(dir); return dir }
  const run = (...args: string[]) => spawnSync(process.execPath, ['--import', 'tsx', 'scripts/release.ts', ...args], { cwd: root, encoding: 'utf8' })

  it('with --dry-run --store publishes into the local store, then --rollback moves back', () => {
    const dir = store()
    const a = tree({ 'index.html': 'a' })
    const b = tree({ 'index.html': 'b' })
    const out = join(dir, 'manifest.json')
    expect(run(a, '--dry-run', '--store', dir, '--out', out).status).toBe(0)
    const published = run(b, '--dry-run', '--store', dir, '--out', out)
    expect(published.status).toBe(0)
    expect(published.stdout).toContain(`Published release ${releaseManifest(b).id.slice(0, 12)} to the local store ${dir}`)
    const rolled = run('--dry-run', '--rollback', '--store', dir)
    expect(rolled.stderr).toBe('')
    expect(rolled.status).toBe(0)
    expect(rolled.stdout).toContain(`Rolled back the local store ${dir} from ${releaseManifest(b).id.slice(0, 12)} to ${releaseManifest(a).id.slice(0, 12)}`)
    expect(currentRelease(dir)).toBe(releaseManifest(a).id)
  })

  it('refuses a rollback without --dry-run, as it refuses a publish, and one without a store', () => {
    const dir = store()
    const noDryRun = run('--rollback', '--store', dir)
    expect(noDryRun.status).not.toBe(0)
    expect(noDryRun.stderr).toContain('No deploy target is configured')
    const noStore = run('--dry-run', '--rollback')
    expect(noStore.status).toBe(2)
    expect(noStore.stderr).toContain('--rollback needs --store')
  })

  it('reports a refused rollback and exits non-zero', () => {
    const dir = store()
    run(tree({ 'index.html': 'a' }), '--dry-run', '--store', dir, '--out', join(dir, 'm.json'))
    const result = run('--dry-run', '--rollback', '--store', dir)
    expect(result.status).toBe(1)
    expect(result.stderr).toContain('No earlier release to roll back to')
  })
})
