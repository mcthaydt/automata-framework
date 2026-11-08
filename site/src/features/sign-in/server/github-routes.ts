// The one function behind "Sign in with GitHub" on the web (spec 7.1). GitHub's web flow needs the app's secret for the
// code exchange and for every refresh, so it can't run in a page; this does only that. It keeps nothing: the refresh
// token travels in a sealed cookie the browser holds, the access token goes to the page in memory, and no game data
// passes through. Nothing is logged. Every response is uncacheable and carries the site's security headers, because the
// host's `_headers` file does not reach a Function.
import { securityHeaders } from '../../../shared/html/security-headers'
import { pkcePair } from './pkce'
import { base64url, seal, unseal } from './seal'

export interface GitHubEnv {
  readonly GITHUB_CLIENT_ID?: string | undefined
  readonly GITHUB_APP_SLUG?: string | undefined
  readonly GITHUB_CLIENT_SECRET?: string | undefined
  readonly COOKIE_KEY?: string | undefined
  /** The site's own origin, `https://automataframework.com`. */
  readonly SITE_ORIGIN: string
}

export interface GitHubDeps {
  readonly fetch: typeof fetch
  now(): number
  random(bytes: number): Uint8Array
}

const START = 'af_gh_start'
const SESSION = 'af_gh'
const COOKIE_PATH = '/api/github/'
const EDITORS = '/editor/app/'
const START_SECONDS = 600
const AUTHORIZE = 'https://github.com/login/oauth/authorize'
const TOKEN_URL = 'https://github.com/login/oauth/access_token'

interface Configured {
  readonly id: string
  readonly secret: string
  readonly key: string
  readonly origin: string
}

function configured(env: GitHubEnv): Configured | undefined {
  const { GITHUB_CLIENT_ID: id, GITHUB_APP_SLUG: slug, GITHUB_CLIENT_SECRET: secret, COOKIE_KEY: key } = env
  return id && slug && secret && key ? { id, secret, key, origin: env.SITE_ORIGIN } : undefined
}

function respond(
  url: URL,
  status: number,
  init: { body?: string; json?: unknown; headers?: HeadersInit; cookies?: readonly string[] } = {},
): Response {
  const headers = new Headers(init.headers)
  headers.set('Cache-Control', 'no-store')
  for (const [name, value] of Object.entries(securityHeaders(url.pathname))) headers.set(name, value)
  for (const cookie of init.cookies ?? []) headers.append('Set-Cookie', cookie)
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json')
    return new Response(JSON.stringify(init.json), { status, headers })
  }
  return new Response(status === 204 || status === 302 ? null : (init.body ?? ''), { status, headers })
}

const redirect = (url: URL, location: string, cookies: readonly string[] = []): Response =>
  respond(url, 302, { headers: { Location: location }, cookies })

const cookie = (name: string, value: string, sameSite: 'Lax' | 'Strict', maxAge: number): string =>
  `${name}=${value}; HttpOnly; Secure; SameSite=${sameSite}; Path=${COOKIE_PATH}; Max-Age=${String(maxAge)}`

const cleared = (name: string, sameSite: 'Lax' | 'Strict'): string => cookie(name, '', sameSite, 0)

function cookieValue(request: Request, name: string): string | undefined {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === name) return rest.join('=')
  }
  return undefined
}

/** A path inside the editors' page, and nothing that could lead elsewhere. */
function safeBack(back: string): boolean {
  return (
    back.startsWith(EDITORS) &&
    !back.includes('\\') &&
    !back.includes('..') &&
    !/[\u0000-\u001f]/.test(back) &&
    !back.startsWith('//')
  )
}

/** The page's own call: the site's Origin and the header a form on another site can't send. */
const fromThePage = (request: Request, origin: string): boolean =>
  request.headers.get('origin') === origin && request.headers.get('x-automata') === '1'

interface GitHubTokens {
  readonly access: string
  readonly refresh: string
  readonly expiresIn: number
  readonly refreshExpiresIn: number
}

async function exchange(deps: GitHubDeps, body: Record<string, string>): Promise<GitHubTokens | undefined> {
  try {
    const response = await deps.fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body),
    })
    const data = (await response.json()) as Record<string, unknown>
    const {
      access_token: access,
      refresh_token: refresh,
      expires_in: expiresIn,
      refresh_token_expires_in: refreshExpiresIn,
    } = data
    if (typeof access !== 'string' || typeof refresh !== 'string') return undefined
    return {
      access,
      refresh,
      expiresIn: typeof expiresIn === 'number' ? expiresIn : 28800,
      refreshExpiresIn: typeof refreshExpiresIn === 'number' ? refreshExpiresIn : 15811200,
    }
  } catch {
    return undefined
  }
}

async function sealedSession(
  config: Configured,
  deps: GitHubDeps,
  refresh: string,
  life: number,
): Promise<string> {
  const value = await seal(
    config.key,
    JSON.stringify({ kind: 'refresh', refresh }),
    deps.now() + life * 1000,
    deps.random,
  )
  return cookie(SESSION, value, 'Strict', life)
}

export async function handleGitHub(request: Request, env: GitHubEnv, deps: GitHubDeps): Promise<Response> {
  const url = new URL(request.url)
  const config = configured(env)
  const route = url.pathname.replace(/^\/api\/github\/?/, '')
  if (config === undefined) return respond(url, 404)

  if (route === 'ping')
    return request.method === 'GET' ? respond(url, 200, { json: { github: 'ready' } }) : respond(url, 405)

  if (route === 'start') {
    if (request.method !== 'GET') return respond(url, 405)
    const back = url.searchParams.get('back') ?? EDITORS
    if (!safeBack(back)) return respond(url, 400, { body: 'That address is not one of the editors.' })
    const state = base64url(deps.random(16))
    const { verifier, challenge } = await pkcePair(deps.random)
    const sealed = await seal(
      config.key,
      JSON.stringify({ kind: 'start', state, verifier, back }),
      deps.now() + START_SECONDS * 1000,
      deps.random,
    )
    const authorize = new URL(AUTHORIZE)
    authorize.searchParams.set('client_id', config.id)
    authorize.searchParams.set('redirect_uri', `${config.origin}/api/github/callback`)
    authorize.searchParams.set('state', state)
    authorize.searchParams.set('code_challenge', challenge)
    authorize.searchParams.set('code_challenge_method', 'S256')
    return redirect(url, authorize.toString(), [cookie(START, sealed, 'Lax', START_SECONDS)])
  }

  if (route === 'callback') {
    if (request.method !== 'GET') return respond(url, 405)
    const started = await unsealStart(config, request, deps)
    if (started === undefined) return respond(url, 400, { body: 'Start again from the editors.' })
    if (url.searchParams.get('error') === 'access_denied')
      return redirect(url, `${started.back}${started.back.includes('?') ? '&' : '?'}github=denied`, [
        cleared(START, 'Lax'),
      ])
    const code = url.searchParams.get('code')
    if (url.searchParams.get('state') !== started.state || code === null)
      return respond(url, 400, { body: 'Start again from the editors.' })
    const tokens = await exchange(deps, {
      client_id: config.id,
      client_secret: config.secret,
      code,
      redirect_uri: `${config.origin}/api/github/callback`,
      code_verifier: started.verifier,
    })
    if (tokens === undefined) return respond(url, 502, { body: 'GitHub did not sign you in. Try again.' })
    return redirect(url, started.back, [
      await sealedSession(config, deps, tokens.refresh, tokens.refreshExpiresIn),
      cleared(START, 'Lax'),
    ])
  }

  if (route === 'token' || route === 'sign-out') {
    if (request.method !== 'POST') return respond(url, 405)
    if (!fromThePage(request, config.origin)) return respond(url, 403)
    if (route === 'sign-out') return signOut(url, request, config, deps)
    const sealed = cookieValue(request, SESSION)
    const stored = sealed === undefined ? undefined : await unseal(config.key, sealed, deps.now())
    const refresh = stored === undefined ? undefined : readKind(stored, 'refresh')?.['refresh']
    const gone = respond(url, 401, { cookies: [cleared(SESSION, 'Strict')] })
    if (typeof refresh !== 'string') return gone
    const tokens = await exchange(deps, {
      client_id: config.id,
      client_secret: config.secret,
      grant_type: 'refresh_token',
      refresh_token: refresh,
    })
    if (tokens === undefined) return gone
    return respond(url, 200, {
      json: { token: tokens.access, expiresAt: deps.now() + tokens.expiresIn * 1000 },
      cookies: [await sealedSession(config, deps, tokens.refresh, tokens.refreshExpiresIn)],
    })
  }

  return respond(url, 404)
}

function readKind(text: string, kind: string): Record<string, unknown> | undefined {
  try {
    const value = JSON.parse(text) as Record<string, unknown>
    return value['kind'] === kind ? value : undefined
  } catch {
    return undefined
  }
}

async function unsealStart(config: Configured, request: Request, deps: GitHubDeps) {
  const sealed = cookieValue(request, START)
  const text = sealed === undefined ? undefined : await unseal(config.key, sealed, deps.now())
  const start = text === undefined ? undefined : readKind(text, 'start')
  const { state, verifier, back } = start ?? {}
  return typeof state === 'string' &&
    typeof verifier === 'string' &&
    typeof back === 'string' &&
    safeBack(back)
    ? { state, verifier, back }
    : undefined
}

/** Revokes the one access token the page sends (never the whole grant, which would also sign the apps out), and forgets the person. */
async function signOut(url: URL, request: Request, config: Configured, deps: GitHubDeps): Promise<Response> {
  let token: unknown
  try {
    token = ((await request.json()) as { token?: unknown }).token
  } catch {
    token = undefined
  }
  if (typeof token === 'string' && token !== '') {
    try {
      await deps.fetch(`https://api.github.com/applications/${encodeURIComponent(config.id)}/token`, {
        method: 'DELETE',
        headers: {
          Authorization: `Basic ${btoa(`${config.id}:${config.secret}`)}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ access_token: token }),
      })
    } catch {
      // A revoke that fails still signs the person out here; the token ends by itself within hours.
    }
  }
  return respond(url, 204, { cookies: [cleared(SESSION, 'Strict')] })
}
