import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { newDepsBase } from './new-deps-base.ts'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** A throwaway repository with a `git` runner bound to it. */
function repo() {
  const root = mkdtempSync(join(tmpdir(), 'deps-base-'))
  roots.push(root)
  const git = (...args: string[]) =>
    execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], {
      cwd: root,
      encoding: 'utf8',
    })
  const commit = (file: string) => {
    writeFileSync(join(root, file), file)
    git('add', file)
    git('commit', '-q', '-m', file)
    return git('rev-parse', 'HEAD').trim()
  }
  git('init', '-q', '-b', 'main')
  return { git, commit }
}

describe('newDepsBase (the manifests `pnpm deps:new` compares with)', () => {
  it('is where HEAD left the --base ref, not its tip after main moved on (CI.API1a)', () => {
    // CI runs on the merge commit GitHub built when the run was queued. If main changes a dependency while the
    // run waits, comparing that old merge commit with the new tip reports main's later changes as this pull
    // request's (an older version reads as a new one).
    const { git, commit } = repo()
    const base = commit('a')
    git('checkout', '-q', '-b', 'pr')
    commit('b')
    git('checkout', '-q', 'main')
    git('merge', '-q', '--no-ff', '-m', 'merge pr', 'pr')
    const queued = git('rev-parse', 'HEAD').trim()
    git('reset', '-q', '--hard', base)
    commit('c') // main moves on
    git('update-ref', 'refs/remotes/origin/main', 'HEAD')
    git('checkout', '-q', queued)

    expect(newDepsBase(git, 'origin/main')).toBe(base)
  })

  it('falls back to the ref as given when there is no common history to find', () => {
    const { git, commit } = repo()
    commit('a')
    expect(newDepsBase(git, 'origin/main')).toBe('origin/main')
  })
})
