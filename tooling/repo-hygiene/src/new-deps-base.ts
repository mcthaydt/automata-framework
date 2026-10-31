/** Runs git in the repository and returns its stdout; throws when git fails. */
export type Git = (...args: string[]) => string

/**
 * The commit whose manifests `pnpm deps:new --base <ref>` compares with: where HEAD left `ref`, not `ref`'s tip.
 *
 * CI checks out the merge commit GitHub built when the run was queued, and on the Owner's runners a run can wait
 * for hours; the merge base is the main that merge commit was built on (CI.API1a, as `api-report`'s base-ref.ts
 * does for CI.API1). Without common history (a shallow clone) it stays `ref`.
 */
export function newDepsBase(git: Git, ref: string): string {
  try {
    return git('merge-base', 'HEAD', ref).trim()
  } catch {
    return ref
  }
}
