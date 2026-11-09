// GitHub's REST API as the Review page needs it: one call, with a path below `https://api.github.com`. The web editors
// and the Automata app each give it their own `fetch` and token, so the cards and the words are the same in both.

export interface GithubResponse {
  readonly status: number
  readonly json: unknown
}

export interface GithubApi {
  request(method: 'GET' | 'PUT' | 'PATCH' | 'POST', path: string, body?: unknown): Promise<GithubResponse>
}
