// The page's side of signing in with GitHub on the web. The site's function does the parts that need its secret; this
// holds what comes back: an access token, in memory only (never in storage or an address), renewed a minute before it
// ends. Two tabs share one Web Lock around the renewal, because GitHub rotates the refresh token and a second use of the
// old one would sign the person out, and they pass the new token to each other over a BroadcastChannel so only one asks.
const TOKEN_LOCK = 'automata-github-token'
const RENEW_EARLY_MS = 60_000
const API = 'https://api.github.com'

export interface WebGitHubSession {
  /** A working access token, or nothing if the person is not signed in (or the network failed). */
  token(): Promise<string | undefined>
  /** The GitHub name of the person signed in. */
  login(): Promise<string | undefined>
  /** True once the function said so, false once it said they are not signed in; nothing before that, or when it could not say. */
  readonly signedIn: boolean | undefined
  /** Goes to GitHub to sign in, and comes back to `back` (a path in the editors). */
  signIn(back: string): void
  signOut(): Promise<void>
  subscribe(listener: () => void): () => void
}

export interface WebGitHubDeps {
  readonly fetch: typeof fetch
  readonly locks?: LockManager | undefined
  readonly channel?: BroadcastChannel | undefined
  now(): number
  navigate(url: string): void
}

/**
 * The name of the GitHub App the site's function signs in with (its public address is `github.com/apps/<name>`), or
 * nothing when the site has no sign-in set up or cannot be reached.
 */
export async function githubApp(fetchFn: typeof fetch): Promise<string | undefined> {
  try {
    const response = await fetchFn('/api/github/ping')
    if (!response.ok) return undefined
    const body = (await response.json()) as { github?: unknown; app?: unknown }
    return body.github === 'ready' && typeof body.app === 'string' ? body.app : undefined
  } catch {
    return undefined
  }
}

/** Whether the site has the sign-in function set up; a page that has not shows no sign-in. */
export async function githubReady(fetchFn: typeof fetch): Promise<boolean> {
  try {
    const response = await fetchFn('/api/github/ping')
    if (!response.ok) return false
    return ((await response.json()) as { github?: unknown }).github === 'ready'
  } catch {
    return false
  }
}

type Message =
  | { readonly kind: 'token'; readonly token: string; readonly expiresAt: number }
  | { readonly kind: 'signed-out' }

export function createWebGitHubSession(deps: WebGitHubDeps): WebGitHubSession {
  const { fetch: request, locks, channel, now, navigate } = deps
  let held: { readonly token: string; readonly expiresAt: number } | undefined
  let name: string | undefined
  let signedIn: boolean | undefined
  const listeners = new Set<() => void>()
  const notify = () => {
    for (const listener of listeners) listener()
  }
  const fresh = () => held !== undefined && now() < held.expiresAt - RENEW_EARLY_MS

  channel?.addEventListener('message', (event) => {
    const message = (event as MessageEvent<Message>).data
    if (message.kind === 'token') {
      held = { token: message.token, expiresAt: message.expiresAt }
      signedIn = true
    } else {
      held = undefined
      name = undefined
      signedIn = false
    }
    notify()
  })

  async function renew(): Promise<string | undefined> {
    // Another tab may have renewed while this one waited for the lock.
    if (fresh()) return held?.token
    try {
      const response = await request('/api/github/token', { method: 'POST', headers: { 'X-Automata': '1' } })
      if (response.status === 401) {
        held = undefined
        signedIn = false
        notify()
        return undefined
      }
      if (!response.ok) return undefined
      const { token, expiresAt } = (await response.json()) as { token: string; expiresAt: number }
      held = { token, expiresAt }
      signedIn = true
      channel?.postMessage({ kind: 'token', token, expiresAt } satisfies Message)
      notify()
      return token
    } catch {
      return undefined
    }
  }

  return {
    get signedIn() {
      return signedIn
    },
    async token() {
      if (fresh()) return held?.token
      return locks === undefined ? renew() : locks.request(TOKEN_LOCK, renew)
    },
    async login() {
      if (name !== undefined) return name
      const token = await this.token()
      if (token === undefined) return undefined
      try {
        const response = await request(`${API}/user`, {
          headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
        })
        if (!response.ok) return undefined
        name = ((await response.json()) as { login?: string }).login
        return name
      } catch {
        return undefined
      }
    },
    signIn(back) {
      navigate(`/api/github/start?back=${encodeURIComponent(back)}`)
    },
    async signOut() {
      const token = held?.token
      try {
        await request('/api/github/sign-out', {
          method: 'POST',
          headers: { 'X-Automata': '1', 'Content-Type': 'application/json' },
          body: JSON.stringify(token === undefined ? {} : { token }),
        })
      } catch {
        // Offline: the cookie stays until the next sign-out; this page forgets the person all the same.
      }
      held = undefined
      name = undefined
      signedIn = false
      channel?.postMessage({ kind: 'signed-out' } satisfies Message)
      notify()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}
