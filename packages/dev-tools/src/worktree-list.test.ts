import { describe, expect, it } from 'vitest'
import { parseWorktreeList } from './worktree-list.ts'

// `git worktree list --porcelain`: one record per worktree, separated by a blank line.
const PORCELAIN = [
  'worktree /repo',
  'HEAD 1111111111111111111111111111111111111111',
  'branch refs/heads/main',
  '',
  'worktree /repo/.claude/worktrees/a',
  'HEAD 2222222222222222222222222222222222222222',
  'branch refs/heads/feature/a',
  '',
  'worktree /repo/.claude/worktrees/detached',
  'HEAD 3333333333333333333333333333333333333333',
  'detached',
  '',
  'worktree /repo/.claude/worktrees/locked',
  'HEAD 4444444444444444444444444444444444444444',
  'branch refs/heads/b',
  'locked',
  '',
  'worktree /repo/.claude/worktrees/locked-why',
  'HEAD 5555555555555555555555555555555555555555',
  'branch refs/heads/c',
  'locked a session is at work',
  '',
  'worktree /repo/.claude/worktrees/gone',
  'HEAD 6666666666666666666666666666666666666666',
  'branch refs/heads/d',
  'prunable gitdir file points to non-existent location',
  '',
].join('\n')

describe('parseWorktreeList', () => {
  it('reads each record: path, branch, detached, locked and prunable', () => {
    expect(parseWorktreeList(PORCELAIN)).toEqual([
      { path: '/repo', branch: 'main', bare: false, locked: false, prunable: false },
      { path: '/repo/.claude/worktrees/a', branch: 'feature/a', bare: false, locked: false, prunable: false },
      { path: '/repo/.claude/worktrees/detached', branch: null, bare: false, locked: false, prunable: false },
      { path: '/repo/.claude/worktrees/locked', branch: 'b', bare: false, locked: true, prunable: false },
      { path: '/repo/.claude/worktrees/locked-why', branch: 'c', bare: false, locked: true, prunable: false },
      { path: '/repo/.claude/worktrees/gone', branch: 'd', bare: false, locked: false, prunable: true },
    ])
  })

  it('reads a bare main repository and a list with no trailing blank line', () => {
    expect(
      parseWorktreeList('worktree /srv/repo.git\nbare\n\nworktree /w\nHEAD 7\nbranch refs/heads/x'),
    ).toEqual([
      { path: '/srv/repo.git', branch: null, bare: true, locked: false, prunable: false },
      { path: '/w', branch: 'x', bare: false, locked: false, prunable: false },
    ])
  })

  it('keeps a path with spaces whole', () => {
    expect(parseWorktreeList('worktree /a b/c\nHEAD 1\ndetached\n')[0]?.path).toBe('/a b/c')
  })
})
