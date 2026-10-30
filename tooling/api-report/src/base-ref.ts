/** Runs git in the repository and returns its stdout; throws when git fails. */
export type Git = (...args: string[]) => string

/**
 * The ref whose API reports a run is compared with: `since` when given, else where HEAD left origin/main.
 *
 * Not origin/main's tip: CI checks out the merge commit GitHub built when the run was queued, and on the
 * Owner's runners a run can wait for hours. If main gains a merge that adds exports meanwhile, comparing the
 * old merge commit with the new tip reads those exports as removed, an "undeclared break" this pull request
 * never made. The merge base is the main the merge commit was built on (its first parent); on a branch it is
 * where the branch left main. Without common history (a shallow clone) it stays origin/main.
 */
export function baseRefFor(git: Git, since?: string): string {
  if (since !== undefined) return since
  try {
    return git('merge-base', 'HEAD', 'origin/main').trim()
  } catch {
    return 'origin/main'
  }
}
