import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { ensureGitleaks, historyScanArgs } from './gitleaks.ts'

// The history scan reads what the checkout's HEAD reaches, never every ref (2026-10-30): CI's full-history
// checkout also fetches every branch on origin, so one lane's unmerged branch with a finding (a false positive in
// a test, at the time) failed every other lane's pull request.
const root = fileURLToPath(new URL('../../..', import.meta.url))
const config = join(root, '.gitleaks.toml')
const plantedKey = fileURLToPath(new URL('../fixtures/secrets/planted.env', import.meta.url))

let binary = ''
beforeAll(async () => {
  binary = await ensureGitleaks({
    cacheDir: join(root, 'node_modules/.cache/gitleaks'),
    platform: process.platform,
    arch: process.arch,
    fetch: (url) => fetch(url),
  })
})

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
    // generic-api-key matched `keyPath: 'effectors.handR.rot.0'` in packages/figures (commit ed9d06d, M3.6b).
    const { dir, commit } = scratchRepository()
    commit('a diagnostic with a key path', {
      'packages/figures/src/pose/pose-library.test.ts':
        "expect(d).toEqual({ keyPath: 'effectors.handR.rot.0' })\n",
    })
    expect(scan(dir)).toBe(0)
  })
})
