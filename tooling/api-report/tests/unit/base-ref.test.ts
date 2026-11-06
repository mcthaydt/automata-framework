import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { baseRefFor } from '#src/base-ref.ts'

const roots: string[] = []
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true })
})

/** A throwaway repository with a `git` runner bound to it. */
function repo() {
  const root = mkdtempSync(join(tmpdir(), 'api-base-'))
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

describe('baseRefFor (the reports a pull request is compared with)', () => {
  it('is where HEAD left origin/main, not origin/main’s tip after main moved on', () => {
    // GitHub builds a pull request's merge commit when its run is queued. While the run waits, main gains
    // a merge that adds exports; comparing the old merge commit with the new tip reads them as removed.
    const { git, commit } = repo()
    const base = commit('a')
    git('checkout', '-q', '-b', 'pr')
    commit('b')
    git('checkout', '-q', 'main')
    git('merge', '-q', '--no-ff', '-m', 'merge pr', 'pr')
    const queued = git('rev-parse', 'HEAD').trim() // the merge commit, first parent `base`
    git('reset', '-q', '--hard', base)
    commit('c') // main moves on
    git('update-ref', 'refs/remotes/origin/main', 'HEAD')
    git('checkout', '-q', queued)

    expect(baseRefFor(git)).toBe(base)
  })

  it('takes an explicit --since ref as given', () => {
    const { git } = repo()
    expect(baseRefFor(git, 'v1.0.0')).toBe('v1.0.0')
  })

  it('falls back to origin/main when there is no common history to find', () => {
    const { git, commit } = repo()
    commit('a')
    expect(baseRefFor(git)).toBe('origin/main')
  })
})
