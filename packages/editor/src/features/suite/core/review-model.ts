// The Review desk's model (editor suite spec §5 flow 10, §9 `review-desk`): one open change set as the desk shows it,
// read from the journal (`ChangeSet.list()`): each changed file's diff from its text before the change set first
// wrote it to its latest, the checks with their measures before and after, the gates it reopens with their recorded
// decisions and links, and the tokens. The desk records nothing; the Ship description is drafted from the same model.
import type {
  ChangeSetCheck,
  ChangeSetSummary,
  GateState,
  WorkspaceFile,
} from '../../../shared/kit/ports/suite-ports.ts'
import { reopenedGates } from './reopened-gates'
import { type Hunk, lineDiff } from './text-diff'

export interface ReviewFile {
  readonly path: string
  /** The change set created it. */
  readonly created: boolean
  /** Its text before the change set first wrote it; `undefined` for a created file. */
  readonly before: string | undefined
  readonly after: string
  readonly hunks: readonly Hunk[]
}

export interface ReviewGates {
  /** Each reopened gate with its recorded decision (`unknown` when the records cannot be read). */
  readonly reopened: readonly GateState[]
  /** Why the decisions are unknown, when they are. */
  readonly unreadable?: string | undefined
}

export interface ReviewChangeSet {
  readonly title: string
  readonly branch: string
  readonly base: string
  readonly files: readonly ReviewFile[]
  readonly checks: readonly ChangeSetCheck[]
  readonly gates: ReviewGates
  readonly tokens: { readonly used: number; readonly cap: number }
}

/**
 * `states` is the `Gates` port's answer for the reopened ids: their states, the reason it failed, or `undefined`
 * without the port ("Gates not readable").
 */
export function reviewModel(
  summary: ChangeSetSummary,
  files: readonly WorkspaceFile[],
  states: readonly GateState[] | { readonly error: string } | undefined,
): ReviewChangeSet {
  const first = new Map<string, string | undefined>()
  const latest = new Map<string, string>()
  for (const write of summary.writes) {
    if (!first.has(write.path)) first.set(write.path, write.before)
    latest.set(write.path, write.after)
  }
  const changed = [...latest]
    .filter(([path, text]) => first.get(path) !== text)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([path, after]): ReviewFile => {
      const before = first.get(path)
      return {
        path,
        created: summary.created.includes(path),
        before,
        after,
        hunks: lineDiff(before ?? '', after),
      }
    })

  const ids = reopenedGates(
    files,
    changed.map((file) => file.path),
  )
  const unknown = (id: string): GateState => ({ id, name: id, decision: 'unknown' })
  const gates: ReviewGates =
    states === undefined || 'error' in states
      ? { reopened: ids.map(unknown), unreadable: states?.error ?? 'Gates not readable' }
      : { reopened: ids.map((id) => states.find((state) => state.id === id) ?? unknown(id)) }

  const { title, branch, base, checks, tokens } = summary
  return { title, branch, base, files: changed, checks, gates, tokens }
}
