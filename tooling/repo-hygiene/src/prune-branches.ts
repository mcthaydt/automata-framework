// The branch clean-up (refactor task 9): reads docs/refactor/branches.md and removes the branches it lists.
//
// Deleting a branch loses its commits unless they are somewhere else, so every step is checked first:
//   - the branch tip must still be the commit the list was written for (a branch that moved is a stop);
//   - a branch listed as merged must be an ancestor of origin/main;
//   - a branch listed to keep its work is tagged first, the tag is pushed, and read back from the remote at that
//     commit, and only then is the branch deleted.
// Any mismatch throws before anything else is deleted. Without `apply` the same checks run and nothing is changed.
import type { Git } from './new-deps-base.ts'

export interface BranchEntry {
  readonly branch: string
  /** The commit the list was written for. */
  readonly sha: string
  /** The tag to create before deleting; absent for a branch whose commits are all on main. */
  readonly tag: string | undefined
}

export interface PruneLine {
  readonly branch: string
  readonly action: 'delete' | 'tag and delete' | 'already gone'
}

// `## delete: ...` lists merged branches; `## tag <prefix>: ...` lists branches to tag as `<prefix>/<branch>` first.
const SECTION = /^##\s+(?:(delete)|tag\s+([\w-]+))\b/i
const ANY_HEADING = /^##\s/
const ENTRY = /^- `([^`]+)` `([0-9a-f]{40})`/

/** The branches in branches.md. A bullet inside an action section that does not parse is an error, never skipped. */
export function parseBranches(markdown: string): BranchEntry[] {
  const entries: BranchEntry[] = []
  const seen = new Set<string>()
  let section: { prefix: string | undefined } | undefined
  for (const line of markdown.split('\n')) {
    if (ANY_HEADING.test(line)) {
      const match = SECTION.exec(line)
      section = match === null ? undefined : { prefix: match[1] === undefined ? match[2] : undefined }
      continue
    }
    if (section === undefined || !line.startsWith('- `')) continue
    const match = ENTRY.exec(line)
    if (match?.[1] === undefined || match[2] === undefined) {
      throw new Error(`branches.md: cannot read this line (want - \`branch\` \`40-character sha\`): ${line}`)
    }
    const branch = match[1]
    if (branch === 'main') throw new Error('branches.md: main is listed to be deleted')
    if (seen.has(branch)) throw new Error(`branches.md: ${branch} is listed twice`)
    seen.add(branch)
    const tag = section.prefix === undefined ? undefined : `${section.prefix}/${branch}`
    entries.push({ branch, sha: match[2], tag })
  }
  return entries
}

/** The commit a ref has on origin, or undefined when it does not exist there. */
function remoteSha(git: Git, ref: string): string | undefined {
  const sha = git('ls-remote', 'origin', ref).trim().split(/\s+/)[0]
  return sha === undefined || sha === '' ? undefined : sha
}

/**
 * Checks every entry, and with `apply` tags and deletes it. Returns what was (or would be) done, in list order.
 * With `apply`, all the checks run before the first change, so a mismatch anywhere leaves every branch in place.
 */
export function prune(entries: readonly BranchEntry[], git: Git, options: { apply: boolean }): PruneLine[] {
  if (options.apply) prune(entries, git, { apply: false })
  return entries.map((entry): PruneLine => {
    const { branch, sha, tag } = entry
    const tip = remoteSha(git, `refs/heads/${branch}`)
    // Idempotent: a second run, or a branch deleted by hand, is done rather than an error.
    if (tip === undefined) return { branch, action: 'already gone' }
    if (tip !== sha)
      throw new Error(`${branch} moved: the list has ${sha.slice(0, 9)}, origin has ${tip.slice(0, 9)}`)

    if (tag === undefined) {
      try {
        git('merge-base', '--is-ancestor', sha, 'origin/main')
      } catch {
        throw new Error(`${branch} is not in origin/main, so deleting it would lose commits`)
      }
    }
    const action = tag === undefined ? 'delete' : 'tag and delete'
    if (!options.apply) return { branch, action }

    if (tag !== undefined) {
      git('tag', '-f', tag, sha)
      git('push', 'origin', `refs/tags/${tag}`)
      const pushed = remoteSha(git, `refs/tags/${tag}`)
      if (pushed !== sha)
        throw new Error(`tag ${tag} is not at ${sha.slice(0, 9)} on origin; ${branch} is kept`)
    }
    git('push', 'origin', '--delete', branch)
    return { branch, action }
  })
}
