import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, describe, expect, it } from 'vitest'

// DT-j (and DT-c's required --to): the bins as a person starts them. Node runs them from source with stdin closed,
// in a folder outside any git checkout, so nothing in this repository can be touched.

const outside = mkdtempSync(join(tmpdir(), 'dev-tools-bin-'))
afterAll(() => rmSync(outside, { recursive: true, force: true }))

const bin = (name: string, ...args: string[]) =>
  spawnSync(process.execPath, [fileURLToPath(new URL(`./${name}.ts`, import.meta.url)), ...args], {
    cwd: outside,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 60_000,
  })

describe('the promote-evidence bin', () => {
  it('prints the usage and exits 0', () => {
    const out = bin('promote-evidence', '--help')
    expect([out.status, out.stderr]).toEqual([0, ''])
    expect(out.stdout).toMatch(/^usage: promote-evidence --to <baselines> \[--from <dir>\] \[<path> …\]/)
  })

  it('exits 2 without --to, and for an unknown option', () => {
    expect([bin('promote-evidence').status, bin('promote-evidence').stderr]).toEqual([
      2,
      'promote-evidence: --to <baselines> is required; see --help\n',
    ])
    const unknown = bin('promote-evidence', '--to', 'b', '--force')
    expect([unknown.status, unknown.stderr]).toEqual([
      2,
      "promote-evidence: unknown option '--force'; see --help\n",
    ])
  })

  it('exits 2 outside a git checkout', () => {
    const out = bin('promote-evidence', '--to', 'baselines')
    expect(out.status).toBe(2)
    expect(out.stderr).toMatch(/^not in a git checkout: /)
  })
})

describe('the worktree-gc bin', () => {
  it('prints the usage and exits 0', () => {
    const out = bin('worktree-gc', '--help')
    expect([out.status, out.stderr]).toEqual([0, ''])
    expect(out.stdout).toMatch(/^usage: worktree-gc \[--apply\] \[--base <branch>\]/)
  })

  it('exits 2 for an unknown option, a missing --base value, and outside a git checkout', () => {
    const unknown = bin('worktree-gc', '--orphans')
    expect([unknown.status, unknown.stderr]).toEqual([
      2,
      "worktree-gc: unknown option '--orphans'; see --help\n",
    ])
    const noBase = bin('worktree-gc', '--base')
    expect([noBase.status, noBase.stderr]).toEqual([2, 'worktree-gc: --base needs a branch; see --help\n'])
    const out = bin('worktree-gc')
    expect(out.status).toBe(2)
    expect(out.stderr).toMatch(/^not in a git checkout: /)
  })
})
