// The in-memory change set (editor suite spec §4.3, §4.5). It owns its journal, as every `ChangeSet` adapter does: the
// files recorded and created, each write's text, the latest run per check and the tokens spent. The workspace notes what it creates here; tokens come only through
// `spend`, and the cap moves only through `raiseCap`; `list()` reads it all. Branch names, the refusals and Ship follow The Last Light's `ChangeSets` (`92e6704`,
// `editor/src/server/changeset.ts`): `edit/<slug>`, one open at a time, Ship checkpoints and keeps it open.
import type { ChangeSet, ChangeSetCheck, ChangeSetSummary, ChangeSetWrite } from '../suite-ports'

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

/** The change set and the journal's other writer: the workspace, which notes the files it creates. */
export interface MemoryChangeSet extends ChangeSet {
  /** The workspace created `path` (a write expecting `'absent'`); kept only while a change set is open. */
  noteCreated(path: string): void
  /** The workspace removed `path`. */
  noteRemoved(path: string): void
  /** Whether the open change set created `path`. */
  created(path: string): boolean
}

interface Open {
  readonly title: string
  readonly branch: string
  readonly files: Set<string>
  readonly created: Set<string>
  readonly writes: ChangeSetWrite[]
  /** The latest run per check id. */
  readonly checks: Map<string, ChangeSetCheck>
  tokens: number
  cap: number
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
        writes: [],
        checks: new Map(),
        tokens: 0,
        cap,
        pending: false,
        commit: base,
      }
    },
    async record(files, writes = []) {
      const current = required('record files in')
      for (const file of files) current.files.add(file)
      for (const write of writes) {
        current.files.add(write.path)
        current.writes.push(write)
      }
      if (files.length > 0 || writes.length > 0) current.pending = true
    },
    async note(checks) {
      const current = required('note checks in')
      for (const check of checks) current.checks.set(check.check, check)
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
    async spend(tokens) {
      const current = required('spend tokens in')
      if (!Number.isInteger(tokens) || tokens < 0)
        throw new RangeError(`tokens must be a whole number of zero or more, got ${tokens}`)
      current.tokens += tokens
    },
    async raiseCap(next) {
      const current = required('raise the cap of')
      if (!Number.isInteger(next) || next <= current.cap)
        throw new RangeError(`the cap only goes up: ${next} is not above ${current.cap}`)
      current.cap = next
    },
    async close() {
      if (open === undefined) return
      // As The Last Light's close refuses uncommitted changes: a recorded file no checkpoint holds would be lost.
      if (open.pending)
        throw new Error('recorded files have changes no checkpoint holds; checkpoint them first')
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
          tokens: { used: open.tokens, cap: open.cap },
          writes: [...open.writes],
          checks: [...open.checks.values()].sort((a, b) => (a.check < b.check ? -1 : 1)),
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
  }
}
