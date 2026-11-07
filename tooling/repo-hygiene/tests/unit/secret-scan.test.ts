import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { ensureRepoGitleaks, historyScanArgs } from '#src/gitleaks.ts'

// The history scan reads what the checkout's HEAD reaches, never every ref (2026-10-30): CI's full-history
// checkout also fetches every branch on origin, so one lane's unmerged branch with a finding (a false positive in
// a test, at the time) failed every other lane's pull request.
const root = fileURLToPath(new URL('../../../..', import.meta.url))
const config = join(root, '.gitleaks.toml')
const plantedKey = fileURLToPath(new URL('../../fixtures/secrets/planted.env', import.meta.url))

let binary = ''
// On a cold cache (every CI checkout starts with none) this downloads the pinned gitleaks release, which can take
// longer than vitest's 10 s hook default on a busy runner (#206's checks job, 2026-10-30): the hook gets its own limit.
const DOWNLOAD_MS = 120_000
beforeAll(async () => {
  binary = await ensureRepoGitleaks(root)
}, DOWNLOAD_MS)

const scratches: string[] = []
afterEach(() => {
  for (const dir of scratches.splice(0)) rmSync(dir, { recursive: true, force: true })
})

function scratchRepository(): {
  dir: string
  commit: (message: string, files: Record<string, string>) => void
} {
  const dir = mkdtempSync(join(tmpdir(), 'af-secret-scan-'))
  scratches.push(dir)
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=ci', '-c', 'user.email=ci@example.com', ...args], {
      cwd: dir,
      stdio: 'pipe',
    })
  git('init', '-q', '-b', 'main')
  const commit = (message: string, files: Record<string, string>) => {
    for (const [file, text] of Object.entries(files)) {
      mkdirSync(join(dir, file, '..'), { recursive: true })
      writeFileSync(join(dir, file), text)
    }
    git('add', '-A')
    git('commit', '-q', '-m', message)
  }
  commit('base', { 'src/index.ts': 'export const ok = 1\n' })
  return { dir, commit }
}

function scan(dir: string): number {
  const result = spawnSync(binary, ['git', '--no-banner', '--redact', ...historyScanArgs(dir, config)], {
    encoding: 'utf8',
  })
  return result.status ?? 1
}

const git = (dir: string, ...args: string[]) =>
  execFileSync('git', ['-c', 'user.name=ci', '-c', 'user.email=ci@example.com', ...args], {
    cwd: dir,
    stdio: 'pipe',
  })

describe('the history scan', () => {
  it('passes the repository config and limits the scan to the history HEAD reaches', () => {
    expect(historyScanArgs('/repo', '/repo/.gitleaks.toml')).toEqual([
      '--config',
      '/repo/.gitleaks.toml',
      '--log-opts=--full-history HEAD',
      '/repo',
    ])
  })

  it('ignores a key that only another branch holds', () => {
    const { dir, commit } = scratchRepository()
    git(dir, 'checkout', '-q', '-b', 'other-lane')
    mkdirSync(join(dir, 'app'), { recursive: true })
    cpSync(plantedKey, join(dir, 'app/planted.env'))
    commit('a key on another branch', {})
    git(dir, 'checkout', '-q', 'main')
    expect(scan(dir)).toBe(0)
  })

  it('still reports a key that HEAD reaches, including one merged from a branch', () => {
    const { dir, commit } = scratchRepository()
    git(dir, 'checkout', '-q', '-b', 'other-lane')
    mkdirSync(join(dir, 'app'), { recursive: true })
    cpSync(plantedKey, join(dir, 'app/planted.env'))
    commit('a key on another branch', {})
    git(dir, 'checkout', '-q', 'main')
    git(dir, 'merge', '-q', '--no-ff', '-m', 'merge', 'other-lane')
    expect(scan(dir)).not.toBe(0)
  })

  it("does not read a content key path in a test's expected diagnostic as a key", () => {
    // generic-api-key matched `keyPath: 'effectors.handR.rot.0'` in packages/3d (commit ed9d06d, M3.6b).
    const { dir, commit } = scratchRepository()
    commit('a diagnostic with a key path', {
      'packages/3d/tests/unit/figures/motion/pose-library.test.ts':
        "expect(d).toEqual({ keyPath: 'effectors.handR.rot.0' })\n",
    })
    expect(scan(dir)).toBe(0)
  })
})
