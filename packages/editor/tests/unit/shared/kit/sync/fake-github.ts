import type { Clock, Http, HttpResponse, Secrets } from '#src/shared/kit/sync/github-sign-in.ts'

// GitHub's device sign-in, the user lookup and the installations list, held in memory. The test says how the person
// behaves (types the code after N polls, installs the app later) and reads what the app sent.

export interface FakeGithubOptions {
  /** Polls that answer "authorization_pending" before the person has typed the code. */
  readonly pendingPolls?: number
  /** The poll (1-based) that answers "slow_down". */
  readonly slowDownAt?: number
  readonly login?: string
  /** Whether the app is installed on the person's account when they sign in. */
  readonly installed?: boolean
  /** What the code step does: `granted`, `denied` or `expired`. */
  readonly outcome?: 'granted' | 'denied' | 'expired'
  /** Seconds an access token lasts (GitHub: 8 hours). */
  readonly tokenSeconds?: number
}

export class FakeGithub implements Http {
  readonly requests: { method: 'GET' | 'POST'; url: string; body?: Record<string, string> }[] = []
  installed: boolean
  private polls = 0
  private issued = 0
  readonly options: FakeGithubOptions

  constructor(_clock: Clock, options: FakeGithubOptions = {}) {
    this.options = options
    this.installed = options.installed ?? true
  }

  async post(url: string, body: Record<string, string>): Promise<HttpResponse> {
    this.requests.push({ method: 'POST', url, body })
    if (url.endsWith('/login/device/code'))
      return ok({
        device_code: 'dev-1',
        user_code: 'WDJB-MJHT',
        verification_uri: 'https://github.com/login/device',
        expires_in: 900,
        interval: 5,
      })
    if (body.grant_type === 'refresh_token') {
      if (body.refresh_token !== 'refresh-1' && body.refresh_token !== 'refresh-2')
        return ok({ error: 'bad_refresh_token' })
      return ok(this.token())
    }
    this.polls++
    if (this.options.outcome === 'denied') return ok({ error: 'access_denied' })
    if (this.options.outcome === 'expired') return ok({ error: 'expired_token' })
    if (this.polls === this.options.slowDownAt) return ok({ error: 'slow_down', interval: 10 })
    if (this.polls <= (this.options.pendingPolls ?? 0)) return ok({ error: 'authorization_pending' })
    return ok(this.token())
  }

  async get(url: string, headers: Record<string, string>): Promise<HttpResponse> {
    this.requests.push({ method: 'GET', url })
    if (!headers.authorization?.startsWith('Bearer token-'))
      return { status: 401, json: { message: 'Bad credentials' } }
    if (url.endsWith('/user')) return ok({ login: this.options.login ?? 'octocat' })
    if (url.endsWith('/user/installations')) return ok({ installations: this.installed ? [{ id: 1 }] : [] })
    return { status: 404, json: {} }
  }

  private token(): Record<string, unknown> {
    this.issued++
    return {
      access_token: `token-${this.issued}`,
      expires_in: this.options.tokenSeconds ?? 28_800,
      refresh_token: `refresh-${this.issued}`,
      refresh_token_expires_in: 15_811_200,
      token_type: 'bearer',
    }
  }
}

const ok = (json: unknown): HttpResponse => ({ status: 200, json })

/** A clock whose `sleep` only moves time forward, and says what it slept. */
export class FakeClock implements Clock {
  time = 1_000_000
  readonly slept: number[] = []
  now = (): number => this.time
  async sleep(ms: number): Promise<void> {
    this.slept.push(ms)
    this.time += ms
  }
}

/** A keychain in memory; `refuse` makes every write fail the way a locked or missing keychain does. */
export class FakeKeychain implements Secrets {
  readonly values: Map<string, string> = new Map<string, string>()
  refuse = false
  async get(name: string): Promise<string | undefined> {
    return this.values.get(name)
  }
  async set(name: string, value: string): Promise<void> {
    if (this.refuse) throw new Error('The keychain is locked.')
    this.values.set(name, value)
  }
  async delete(name: string): Promise<void> {
    this.values.delete(name)
  }
}
