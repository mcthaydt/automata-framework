// The in-memory change set (editor suite spec §4.3, §4.5). It owns its journal, as every `ChangeSet` adapter does: the
// files recorded and created and the tokens used, so the workspace and the Ask of the same suite write to it and
// `list()` reads it. Branch names, the refusals and Ship follow The Last Light's `ChangeSets` (`92e6704`,
// `editor/src/server/changeset.ts`): `edit/<slug>`, one open at a time, Ship checkpoints and keeps it open.
import type { ChangeSet, ChangeSetSummary } from '../suite-ports'

export interface MemoryChangeSetOptions {
  /** The branch a change set starts from (default `main`). */
  readonly base?: string | undefined
  /** The assistant's tokens one change set may use (default 200 000, The Last Light's). */
  readonly tokenCap?: number | undefined
  /** The repository's web address, for the compare link (default `https://github.com/example/game`). */
  readonly remote?: string | undefined
  /** True when `gh` is there and logged in, so Ship opens a draft PR (default false: only the compare link). */
  readonly gh?: boolean | undefined
}

/** The change set and the journal's other writers: the workspace's created files and the Ask's tokens. */
export interface MemoryChangeSet extends ChangeSet {
  /** The workspace created `path` (a write expecting `'absent'`); kept only while a change set is open. */
  noteCreated(path: string): void
  /** The workspace removed `path`. */
  noteRemoved(path: string): void
  /** Whether the open change set created `path`. */
  created(path: string): boolean
  /** An Ask used `tokens`; counted only while a change set is open. */
  noteTokens(tokens: number): void
}

interface Open {
  readonly title: string
  readonly branch: string
  readonly files: Set<string>
  readonly created: Set<string>
  tokens: number
  /** Files recorded since the last checkpoint. */
  pending: boolean
  commit: string
}

/** `edit/` and the title in lower-case words joined by `-`; rejects a title with no letter or digit. */
function branchName(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (slug === '') throw new Error(`"${title}" gives no branch name: use a letter or a digit`)
  return `edit/${slug}`
}

const sorted = (paths: ReadonlySet<string>): string[] => [...paths].sort()

export function createMemoryChangeSet(options: MemoryChangeSetOptions = {}): MemoryChangeSet {
  const base = options.base ?? 'main'
  const cap = options.tokenCap ?? 200_000
  const remote = options.remote ?? 'https://github.com/example/game'
  let open: Open | undefined
  let commits = 0
  let prs = 0

  const required = (doing: string): Open => {
    if (open === undefined) throw new Error(`no change set is open to ${doing}`)
    return open
  }

  /** A made-up commit id, 40 hex digits like git's, different for every checkpoint. */
  const nextCommit = (): string => (++commits).toString(16).padStart(40, '0')

  const checkpoint = async (_message: string): Promise<{ commit: string }> => {
    const current = required('checkpoint')
    if (current.pending) {
      current.commit = nextCommit()
      current.pending = false
    }
    return { commit: current.commit }
  }

  return {
    async current() {
      return open === undefined ? undefined : { title: open.title, branch: open.branch, base }
    },
    async begin(title) {
      if (open !== undefined) throw new Error(`the change set "${open.title}" is still open`)
      open = {
        title,
        branch: branchName(title),
        files: new Set(),
        created: new Set(),
        tokens: 0,
        pending: false,
        commit: base,
      }
    },
    async record(files) {
      const current = required('record files in')
      for (const file of files) current.files.add(file)
      if (files.length > 0) current.pending = true
    },
    checkpoint,
    async ship(draft) {
      const { branch } = required('ship')
      await checkpoint(draft.title)
      const query = `expand=1&title=${encodeURIComponent(draft.title)}&body=${encodeURIComponent(draft.body)}`
      return {
        branch,
        pushed: true,
        ...(options.gh === true ? { pr: `${remote}/pull/${++prs}` } : {}),
        compareUrl: `${remote}/compare/${base}...${branch}?${query}`,
      }
    },
    async close() {
      required('close')
      open = undefined
    },
    async list(): Promise<ChangeSetSummary[]> {
      if (open === undefined) return []
      return [
        {
          title: open.title,
          branch: open.branch,
          base,
          files: sorted(open.files),
          created: sorted(open.created),
          tokens: { used: open.tokens, cap },
        },
      ]
    },
    noteCreated(path) {
      open?.created.add(path)
    },
    noteRemoved(path) {
      open?.created.delete(path)
    },
    created(path) {
      return open?.created.has(path) ?? false
    },
    noteTokens(tokens) {
      if (open !== undefined) open.tokens += tokens
    },
  }
}
