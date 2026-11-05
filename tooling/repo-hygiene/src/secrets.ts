// Usage: node tooling/repo-hygiene/src/secrets.ts   (the root `pnpm secrets`)
//
// The secret scan over the full Git history, with the pinned gitleaks release binary.
// 1. Self-test: commit fixtures/secrets/ into a scratch repository and require gitleaks to report the planted
//    key. A scanner that misses it cannot vouch for anything below.
// 2. Scan every commit HEAD reaches with .gitleaks.toml (which allowlists that fixture folder and one known false
//    positive) and require no finding. Other refs are not scanned: see historyScanArgs. A shallow clone fails: its
//    history is incomplete (CI checks out with fetch-depth 0).
import { execFileSync, spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureRepoGitleaks, historyScanArgs } from './gitleaks.ts'

const root = fileURLToPath(new URL('../../..', import.meta.url))
const fixture = fileURLToPath(new URL('../fixtures/secrets', import.meta.url))

function gitleaks(binary: string, args: readonly string[]): { status: number; output: string } {
  const result = spawnSync(binary, ['git', '--no-banner', '--redact', ...args], { encoding: 'utf8' })
  return { status: result.status ?? 1, output: `${result.stdout ?? ''}${result.stderr ?? ''}` }
}

function fail(message: string, output: string): never {
  console.error(`secrets: ${message}`)
  console.error(output)
  process.exit(1)
}

const binary = await ensureRepoGitleaks(root)

const scratch = mkdtempSync(join(tmpdir(), 'af-secrets-selftest-'))
try {
  cpSync(fixture, scratch, { recursive: true })
  const git = (...args: string[]) => execFileSync('git', args, { cwd: scratch, stdio: 'pipe' })
  git('init', '-q')
  git('add', '.')
  git(
    '-c',
    'user.name=selftest',
    '-c',
    'user.email=selftest@invalid',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '-qm',
    'planted',
  )
  const planted = gitleaks(binary, [scratch])
  if (planted.status !== 1)
    fail(`the self-test's planted key was not reported (exit ${planted.status})`, planted.output)
  console.log('secrets: self-test reports the planted key, as it should')
} finally {
  rmSync(scratch, { recursive: true, force: true })
}

const shallow = execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: root, encoding: 'utf8' })
if (shallow.trim() === 'true')
  fail('this clone is shallow; the scan needs the full history (fetch-depth: 0)', '')

const history = gitleaks(binary, historyScanArgs(root, join(root, '.gitleaks.toml')))
if (history.status !== 0)
  fail('gitleaks found secrets in the history (values redacted above)', history.output)
console.log(history.output.trim())
console.log('secrets: no leaks in the full history')
