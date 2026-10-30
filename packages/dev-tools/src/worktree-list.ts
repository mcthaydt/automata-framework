/** One record of `git worktree list --porcelain`. */
export interface WorktreeRecord {
  readonly path: string
  /** The branch checked out, without `refs/heads/`; null for a detached HEAD or a bare repository. */
  readonly branch: string | null
  readonly bare: boolean
  /** `git worktree lock`: a session still at work there. */
  readonly locked: boolean
  /** Git's record of a worktree whose folder is gone (`git worktree prune` drops it). */
  readonly prunable: boolean
}

/** Every record of `git worktree list --porcelain`, in git's order (the main checkout first). */
export function parseWorktreeList(porcelain: string): WorktreeRecord[] {
  const records: WorktreeRecord[] = []
  for (const block of porcelain.split(/\n\s*\n/)) {
    const lines = block.split('\n').filter((line) => line !== '')
    const path = lines.find((line) => line.startsWith('worktree '))?.slice('worktree '.length)
    if (path === undefined) continue
    const branchRef = lines.find((line) => line.startsWith('branch '))?.slice('branch '.length)
    records.push({
      path,
      branch: branchRef === undefined ? null : branchRef.replace(/^refs\/heads\//, ''),
      bare: lines.includes('bare'),
      locked: lines.some((line) => line === 'locked' || line.startsWith('locked ')),
      prunable: lines.some((line) => line === 'prunable' || line.startsWith('prunable ')),
    })
  }
  return records
}
