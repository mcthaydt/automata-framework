import type { GithubApi, GithubResponse } from '#src/shared/kit/review/github-api.ts'

// GitHub's pull request, file and check endpoints, held in memory. A test adds pull requests and says what their
// checks did; it reads the requests the app made.

export interface FakePull {
  readonly number: number
  readonly title: string
  readonly author: string
  readonly branch: string
  readonly files: readonly string[]
  readonly state?: 'open' | 'closed'
  /** Check runs: name and what happened (`conclusion` absent means it is still running). */
  readonly runs?: readonly { name: string; conclusion?: string }[]
  /** Commit statuses: context and state. */
  readonly statuses?: readonly { context: string; state: string }[]
}

export class FakePulls implements GithubApi {
  readonly requests: { method: string; path: string }[] = []
  readonly pulls: FakePull[] = []

  add(pull: FakePull): this {
    this.pulls.push(pull)
    return this
  }

  async request(method: 'GET' | 'PUT' | 'PATCH' | 'POST', path: string): Promise<GithubResponse> {
    this.requests.push({ method, path })
    const open = /^\/repos\/[^/]+\/[^/]+\/pulls\?/.exec(path)
    if (method === 'GET' && open)
      return ok(
        this.pulls
          .filter((pull) => (pull.state ?? 'open') === 'open')
          .map((pull) => ({
            number: pull.number,
            title: pull.title,
            user: { login: pull.author },
            head: { ref: pull.branch, sha: `sha-${pull.number}` },
          })),
      )
    const files = /\/pulls\/(\d+)\/files/.exec(path)
    if (method === 'GET' && files)
      return ok(this.byNumber(files[1])?.files.map((filename) => ({ filename, status: 'modified' })) ?? [])
    const runs = /\/commits\/sha-(\d+)\/check-runs/.exec(path)
    if (method === 'GET' && runs)
      return ok({
        check_runs: (this.byNumber(runs[1])?.runs ?? []).map((run) => ({
          name: run.name,
          status: run.conclusion === undefined ? 'in_progress' : 'completed',
          conclusion: run.conclusion ?? null,
        })),
      })
    const status = /\/commits\/sha-(\d+)\/status/.exec(path)
    if (method === 'GET' && status) return ok({ statuses: this.byNumber(status[1])?.statuses ?? [] })
    return { status: 404, json: { message: 'Not Found' } }
  }

  private byNumber(number: string | undefined): FakePull | undefined {
    return this.pulls.find((pull) => String(pull.number) === number)
  }
}

const ok = (json: unknown): GithubResponse => ({ status: 200, json })
