import { type EditorRow, editorsTouched } from './editors-touched'
import type { GithubApi } from './github-api'
import type { ChecksState, ReviewGame, WaitingChange } from './review-port'

// The Review page's list: one card per open pull request whose branch starts with `claude/` or whose author is not
// the person. Claude Code pushes as the person, so the branch name is what marks Claude's work.

export interface WaitingGame extends ReviewGame {
  /** The game's editor list rows, for naming the editors a change touches. */
  readonly rows: readonly EditorRow[]
  /** The suite's label for each editor id. */
  readonly labels: Readonly<Record<string, string>>
}

const UNREADABLE = 'Automata could not read the changes waiting on GitHub. Sign in again.'
const FAILED = new Set(['failure', 'timed_out', 'cancelled', 'action_required', 'startup_failure'])
const PASSED = new Set(['success', 'neutral', 'skipped'])

interface Pull {
  readonly number: number
  readonly title: string
  readonly user: { readonly login: string }
  readonly head: { readonly ref: string; readonly sha: string }
}

async function readJson<A>(api: GithubApi, path: string): Promise<A> {
  const response = await api.request('GET', path)
  if (response.status !== 200) throw new Error(UNREADABLE)
  return response.json as A
}

/** The state of a commit's checks from its check runs and its older-style statuses, the failed one named. */
async function checksOf(
  api: GithubApi,
  base: string,
  sha: string,
): Promise<{ checks: ChecksState; failedCheck?: string }> {
  const runs = (
    await readJson<{ check_runs: { name: string; status: string; conclusion: string | null }[] }>(
      api,
      `${base}/commits/${sha}/check-runs?per_page=100`,
    )
  ).check_runs
  const statuses = (
    await readJson<{ statuses: { context: string; state: string }[] }>(api, `${base}/commits/${sha}/status`)
  ).statuses
  const failed =
    runs.find((run) => run.conclusion !== null && FAILED.has(run.conclusion))?.name ??
    statuses.find((status) => status.state === 'failure' || status.state === 'error')?.context
  if (failed !== undefined) return { checks: 'failed', failedCheck: failed }
  if (runs.some((run) => run.status !== 'completed') || statuses.some((status) => status.state === 'pending'))
    return { checks: 'running' }
  if (runs.length + statuses.length === 0) return { checks: 'none' }
  const settled = runs.every((run) => run.conclusion !== null && PASSED.has(run.conclusion))
  return { checks: settled ? 'passed' : 'none' }
}

export async function listWaiting(api: GithubApi, game: WaitingGame): Promise<WaitingChange[]> {
  const base = `/repos/${game.repo.owner}/${game.repo.name}`
  const pulls = await readJson<Pull[]>(api, `${base}/pulls?state=open&per_page=100`)
  const waiting = pulls.filter((pull) => pull.head.ref.startsWith('claude/') || pull.user.login !== game.me)
  return Promise.all(
    waiting.map(async (pull) => {
      const files = await readJson<{ filename: string }[]>(
        api,
        `${base}/pulls/${pull.number}/files?per_page=100`,
      )
      const { checks, failedCheck } = await checksOf(api, base, pull.head.sha)
      return {
        id: pull.number,
        title: pull.title,
        author: pull.user.login,
        branch: pull.head.ref,
        editors: editorsTouched(
          files.map((file) => file.filename),
          game.rows,
          game.labels,
        ),
        checks,
        ...(failedCheck === undefined ? {} : { failedCheck }),
      }
    }),
  )
}
