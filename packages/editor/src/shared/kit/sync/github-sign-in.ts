// Signing in to GitHub with a code the person types on github.com (GitHub's device flow), so there is no password,
// no redirect page and no secret in the app. The token is kept only in the device's keychain, and an 8-hour token is
// renewed with its refresh token. The network, the keychain and the clock are arguments, so the web editors and the
// Automata app use the same code and a test uses a fake GitHub.

export interface HttpResponse {
  readonly status: number
  readonly json: unknown
}

export interface Http {
  post(url: string, body: Record<string, string>, headers?: Record<string, string>): Promise<HttpResponse>
  get(url: string, headers: Record<string, string>): Promise<HttpResponse>
}

/** The device's keychain. `set` rejects when the keychain refuses (locked, missing, not allowed). */
export interface Secrets {
  get(name: string): Promise<string | undefined>
  set(name: string, value: string): Promise<void>
  delete(name: string): Promise<void>
}

export interface Clock {
  now(): number
  sleep(ms: number): Promise<void>
}

export type SignInStep =
  | { readonly kind: 'code'; readonly userCode: string; readonly url: string }
  | { readonly kind: 'install'; readonly url: string }
  | { readonly kind: 'done'; readonly login: string }
  | { readonly kind: 'failed'; readonly message: string }

/** The words of the sign-in dialog, in one place. */
export const SIGN_IN_WORDS = {
  code: (userCode: string): string => `Type this code on GitHub: ${userCode}`,
  open: 'Open GitHub',
  copy: 'Copy code',
  install: 'Let Automata see your games',
  keychain: "Automata can't keep your GitHub sign-in on this device.",
  denied: 'GitHub said no. Start again if you want to connect.',
  expired: 'That code ran out. Start again to get a new one.',
  offline: "Couldn't reach GitHub. Check your internet and try again.",
} as const

export interface SignInOptions {
  /** The GitHub App's name in its address, for the "install" step. */
  readonly appSlug?: string
}

const SECRET = 'github'
const GITHUB = 'https://github.com'
const API = 'https://api.github.com'
const JSON_HEADERS = { accept: 'application/json' }
/** A token is renewed this long before it expires, so a request never carries one that dies on the way. */
const RENEW_EARLY_MS = 60_000
const INSTALL_WAIT_MS = 10 * 60_000
const INSTALL_POLL_MS = 5000

interface Kept {
  readonly clientId: string
  readonly accessToken: string
  readonly expiresAt: number
  readonly refreshToken: string | undefined
  readonly refreshExpiresAt: number
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

function grantOf(clientId: string, json: unknown, now: number): Kept | undefined {
  if (!isRecord(json) || typeof json.access_token !== 'string') return undefined
  const seconds = (value: unknown, otherwise: number): number =>
    typeof value === 'number' ? value : otherwise
  return {
    clientId,
    accessToken: json.access_token,
    expiresAt: now + seconds(json.expires_in, 28_800) * 1000,
    refreshToken: typeof json.refresh_token === 'string' ? json.refresh_token : undefined,
    refreshExpiresAt: now + seconds(json.refresh_token_expires_in, 0) * 1000,
  }
}

async function readKept(secrets: Secrets): Promise<Kept | undefined> {
  try {
    const text = await secrets.get(SECRET)
    return text === undefined ? undefined : (JSON.parse(text) as Kept)
  } catch {
    return undefined
  }
}

/** The token to call GitHub with, renewed if it ran out, or `undefined` when the person must sign in again. */
export async function githubToken(http: Http, secrets: Secrets, clock: Clock): Promise<string | undefined> {
  const kept = await readKept(secrets)
  if (kept === undefined) return undefined
  if (clock.now() < kept.expiresAt - RENEW_EARLY_MS) return kept.accessToken
  if (kept.refreshToken === undefined || clock.now() >= kept.refreshExpiresAt) return undefined
  const response = await http.post(
    `${GITHUB}/login/oauth/access_token`,
    { client_id: kept.clientId, grant_type: 'refresh_token', refresh_token: kept.refreshToken },
    JSON_HEADERS,
  )
  const renewed = grantOf(kept.clientId, response.json, clock.now())
  if (renewed === undefined) return undefined
  try {
    await secrets.set(SECRET, JSON.stringify(renewed))
  } catch {
    // The token still works for this session; the next start asks again.
  }
  return renewed.accessToken
}

const bearer = (token: string): Record<string, string> => ({
  authorization: `Bearer ${token}`,
  accept: 'application/vnd.github+json',
})

async function loginOf(http: Http, token: string): Promise<string | undefined> {
  const response = await http.get(`${API}/user`, bearer(token))
  return response.status === 200 && isRecord(response.json) && typeof response.json.login === 'string'
    ? response.json.login
    : undefined
}

async function isInstalled(http: Http, token: string): Promise<boolean> {
  const response = await http.get(`${API}/user/installations`, bearer(token))
  return (
    response.status === 200 &&
    isRecord(response.json) &&
    Array.isArray(response.json.installations) &&
    response.json.installations.length > 0
  )
}

/**
 * The steps of signing in. Show the `code`, wait; show `install` if the app is not on the person's account, wait;
 * `done` names who signed in, or `failed` says why not. With a sign-in already kept, it goes straight to `done`.
 */
export async function* signIn(
  http: Http,
  secrets: Secrets,
  clientId: string,
  clock: Clock,
  options: SignInOptions = {},
): AsyncGenerator<SignInStep> {
  try {
    const existing = await githubToken(http, secrets, clock)
    const known = existing === undefined ? undefined : await loginOf(http, existing)
    if (known !== undefined) return yield { kind: 'done', login: known }

    const asked = await http.post(`${GITHUB}/login/device/code`, { client_id: clientId }, JSON_HEADERS)
    const device = asked.json
    if (!isRecord(device) || typeof device.device_code !== 'string' || typeof device.user_code !== 'string')
      return yield { kind: 'failed', message: SIGN_IN_WORDS.offline }
    yield {
      kind: 'code',
      userCode: device.user_code,
      url: typeof device.verification_uri === 'string' ? device.verification_uri : `${GITHUB}/login/device`,
    }

    let interval = typeof device.interval === 'number' ? device.interval : 5
    const deadline = clock.now() + (typeof device.expires_in === 'number' ? device.expires_in : 900) * 1000
    let grant: Kept | undefined
    while (grant === undefined) {
      if (clock.now() >= deadline) return yield { kind: 'failed', message: SIGN_IN_WORDS.expired }
      await clock.sleep(interval * 1000)
      const polled = await http.post(
        `${GITHUB}/login/oauth/access_token`,
        {
          client_id: clientId,
          device_code: device.device_code,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        },
        JSON_HEADERS,
      )
      const body = polled.json
      const error = isRecord(body) && typeof body.error === 'string' ? body.error : undefined
      if (error === 'slow_down')
        interval = isRecord(body) && typeof body.interval === 'number' ? body.interval : interval + 5
      else if (error === 'access_denied') return yield { kind: 'failed', message: SIGN_IN_WORDS.denied }
      else if (error === 'expired_token') return yield { kind: 'failed', message: SIGN_IN_WORDS.expired }
      else if (error === undefined) {
        grant = grantOf(clientId, body, clock.now())
        if (grant === undefined) return yield { kind: 'failed', message: SIGN_IN_WORDS.offline }
      }
    }

    try {
      await secrets.set(SECRET, JSON.stringify(grant))
    } catch {
      return yield { kind: 'failed', message: SIGN_IN_WORDS.keychain }
    }

    if (!(await isInstalled(http, grant.accessToken))) {
      yield { kind: 'install', url: `${GITHUB}/apps/${options.appSlug ?? 'automata'}/installations/new` }
      const until = clock.now() + INSTALL_WAIT_MS
      while (!(await isInstalled(http, grant.accessToken))) {
        if (clock.now() >= until) return yield { kind: 'failed', message: SIGN_IN_WORDS.install }
        await clock.sleep(INSTALL_POLL_MS)
      }
    }

    const login = await loginOf(http, grant.accessToken)
    yield login === undefined ? { kind: 'failed', message: SIGN_IN_WORDS.offline } : { kind: 'done', login }
  } catch {
    yield { kind: 'failed', message: SIGN_IN_WORDS.offline }
  }
}
