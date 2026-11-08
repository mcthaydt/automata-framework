// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { handleGitHub } from '../../../src/features/sign-in/server/github-routes'
import { securityHeaders } from '../../../src/shared/html/security-headers'

// The sign-in function (spec 7.1): GitHub's web flow with PKCE, one cookie for the start and one for the refresh token,
// a token endpoint only the site's own page may call, and nothing stored or logged. GitHub is a fake `fetch`.

const SITE = 'https://automataframework.com'
const ENV = {
  GITHUB_CLIENT_ID: 'Iv1.client',
  GITHUB_APP_SLUG: 'automata',
  GITHUB_CLIENT_SECRET: 'the-client-secret',
  COOKIE_KEY: Buffer.from(new Uint8Array(32).map((_, i) => i * 3 + 1)).toString('base64'),
  SITE_ORIGIN: SITE,
}
const random = (n: number): Uint8Array => new Uint8Array(n).map((_, i) => (i * 29 + 5) % 256)

interface Seen {
  readonly url: string
  readonly method: string
  readonly body: string
  readonly auth: string | null
}

/** A GitHub that answers the code exchange, the refresh and the revoke, and remembers what it was asked. */
function github(options: { refusesRefresh?: boolean; exchange?: Record<string, unknown> } = {}) {
  const seen: Seen[] = []
  let issued = 0
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const body = typeof init?.body === 'string' ? init.body : ''
    seen.push({
      url,
      method: init?.method ?? 'GET',
      body,
      auth: new Headers(init?.headers).get('authorization'),
    })
    const json = (value: unknown, status = 200) =>
      new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json' } })
    if (url === 'https://github.com/login/oauth/access_token') {
      const asked = JSON.parse(body) as Record<string, string>
      if (asked['grant_type'] === 'refresh_token') {
        if (options.refusesRefresh === true) return json({ error: 'bad_refresh_token' })
        issued += 1
        return json({
          access_token: `ghu_access_${String(issued)}`,
          refresh_token: `ghr_refresh_${String(issued)}`,
          expires_in: 28800,
          refresh_token_expires_in: 15811200,
        })
      }
      return json(
        options.exchange ?? {
          access_token: 'ghu_first',
          refresh_token: 'ghr_first',
          expires_in: 28800,
          refresh_token_expires_in: 15811200,
        },
      )
    }
    if (url.startsWith('https://api.github.com/applications/') && init?.method === 'DELETE')
      return new Response(null, { status: 204 })
    return json({ message: 'unexpected' }, 500)
  }) as typeof fetch
  return { seen, fetchFn }
}

function deps(fetchFn: typeof fetch, now = 1_000_000) {
  return { fetch: fetchFn, now: () => now, random }
}

const call = (
  path: string,
  init: RequestInit & { cookie?: string } = {},
  env: Partial<typeof ENV> = {},
  fetchFn: typeof fetch = github().fetchFn,
) => {
  const { cookie, ...rest } = init
  const headers = new Headers(rest.headers)
  if (cookie !== undefined) headers.set('cookie', cookie)
  return handleGitHub(
    new Request(`${SITE}${path}`, { ...rest, headers, redirect: 'manual' }),
    { ...ENV, ...env },
    deps(fetchFn),
  )
}

const cookieOf = (response: Response, name: string): string | undefined =>
  response.headers.getSetCookie().find((line) => line.startsWith(`${name}=`))

const valueOf = (setCookie: string | undefined): string =>
  (setCookie?.split(';')[0] ?? '').split('=').slice(1).join('=')

/** Walks start then a good callback, returning the callback's response and what GitHub saw. */
async function signedIn(back = '/editor/app/') {
  const gh = github()
  const start = await call(`/api/github/start?back=${encodeURIComponent(back)}`, {}, {}, gh.fetchFn)
  const startCookie = valueOf(cookieOf(start, 'af_gh_start'))
  const state = new URL(start.headers.get('location') ?? '').searchParams.get('state') ?? ''
  const callback = await call(
    `/api/github/callback?code=thecode&state=${state}`,
    { cookie: `af_gh_start=${startCookie}` },
    {},
    gh.fetchFn,
  )
  return { gh, start, callback, state }
}

describe('ping', () => {
  it('says ready when everything is set', async () => {
    const response = await call('/api/github/ping')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ github: 'ready' })
  })

  it.each(['GITHUB_CLIENT_ID', 'GITHUB_APP_SLUG', 'GITHUB_CLIENT_SECRET', 'COOKIE_KEY'] as const)(
    'is 404 when %s is missing, and so is every other route',
    async (name) => {
      expect((await call('/api/github/ping', {}, { [name]: undefined })).status).toBe(404)
      expect((await call('/api/github/start', {}, { [name]: undefined })).status).toBe(404)
    },
  )
})

describe('start', () => {
  it('sets the start cookie so GitHub’s redirect back can carry it, and sends the person to GitHub with PKCE', async () => {
    const response = await call('/api/github/start?back=/editor/app/%3Fgame%3Dx')
    expect(response.status).toBe(302)
    const cookie = cookieOf(response, 'af_gh_start') ?? ''
    // Review Focus 3: a Strict cookie is not sent on the cross-site navigation back from GitHub.
    expect(cookie).toContain('SameSite=Lax')
    for (const part of ['HttpOnly', 'Secure', 'Path=/api/github/', 'Max-Age=600'])
      expect(cookie).toContain(part)
    const location = new URL(response.headers.get('location') ?? '')
    expect(`${location.origin}${location.pathname}`).toBe('https://github.com/login/oauth/authorize')
    expect(location.searchParams.get('client_id')).toBe('Iv1.client')
    expect(location.searchParams.get('redirect_uri')).toBe(`${SITE}/api/github/callback`)
    expect(location.searchParams.get('code_challenge_method')).toBe('S256')
    expect(location.searchParams.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(location.searchParams.get('state')).toBeTruthy()
  })

  it.each([
    'https://evil.example/',
    '//evil.example/editor/app/',
    '/docs',
    '/editor/app/../../docs',
    '/editor/app/\\evil',
    'javascript:alert(1)',
  ])('refuses back=%s', async (back) => {
    const response = await call(`/api/github/start?back=${encodeURIComponent(back)}`)
    expect(response.status).toBe(400)
    expect(cookieOf(response, 'af_gh_start')).toBeUndefined()
  })

  it('goes back to the editors when no back is given', async () => {
    expect((await call('/api/github/start')).status).toBe(302)
  })
})

describe('callback', () => {
  it('exchanges the code with the verifier and the secret, keeps the refresh token in a Strict cookie, and puts no token in the address', async () => {
    const { gh, callback } = await signedIn('/editor/app/?game=x')
    expect(callback.status).toBe(302)
    expect(callback.headers.get('location')).toBe('/editor/app/?game=x')
    const exchange = JSON.parse(
      gh.seen.find((seen) => seen.url.endsWith('/access_token'))?.body ?? '{}',
    ) as Record<string, string>
    expect(exchange).toMatchObject({
      client_id: 'Iv1.client',
      client_secret: 'the-client-secret',
      code: 'thecode',
    })
    expect(exchange['code_verifier']).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(exchange['redirect_uri']).toBe(`${SITE}/api/github/callback`)
    const session = cookieOf(callback, 'af_gh') ?? ''
    for (const part of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Path=/api/github/', 'Max-Age=15811200'])
      expect(session).toContain(part)
    expect(cookieOf(callback, 'af_gh_start')).toContain('Max-Age=0')
    expect(callback.headers.get('location')).not.toContain('ghu_')
    expect(session).not.toContain('ghr_')
  })

  it('is 400 for a wrong state and sets nothing', async () => {
    const start = await call('/api/github/start')
    const response = await call('/api/github/callback?code=c&state=wrong', {
      cookie: `af_gh_start=${valueOf(cookieOf(start, 'af_gh_start'))}`,
    })
    expect(response.status).toBe(400)
    expect(response.headers.getSetCookie()).toEqual([])
  })

  it('is 400 with no start cookie', async () => {
    expect((await call('/api/github/callback?code=c&state=s')).status).toBe(400)
  })

  it('sends a person who said no back to where they were, to say so', async () => {
    const start = await call('/api/github/start?back=/editor/app/')
    const response = await call('/api/github/callback?error=access_denied&state=x', {
      cookie: `af_gh_start=${valueOf(cookieOf(start, 'af_gh_start'))}`,
    })
    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('/editor/app/?github=denied')
  })

  it('is 502 when GitHub does not answer with a refresh token', async () => {
    const gh = github({ exchange: { access_token: 'ghu_only' } })
    const start = await call('/api/github/start', {}, {}, gh.fetchFn)
    const state = new URL(start.headers.get('location') ?? '').searchParams.get('state') ?? ''
    const response = await call(
      `/api/github/callback?code=c&state=${state}`,
      { cookie: `af_gh_start=${valueOf(cookieOf(start, 'af_gh_start'))}` },
      {},
      gh.fetchFn,
    )
    expect(response.status).toBe(502)
    expect(cookieOf(response, 'af_gh')).toBeUndefined()
  })
})

describe('token', () => {
  const headers = { origin: SITE, 'x-automata': '1' }

  it.each([
    [{ 'x-automata': '1' }],
    [{ origin: SITE }],
    [{ origin: 'https://evil.example', 'x-automata': '1' }],
  ])('is 403 without the site’s Origin and X-Automata: 1 (%j)', async (bad) => {
    const { callback } = await signedIn()
    const response = await call('/api/github/token', {
      method: 'POST',
      headers: bad,
      cookie: `af_gh=${valueOf(cookieOf(callback, 'af_gh'))}`,
    })
    expect(response.status).toBe(403)
  })

  it('refreshes, hands the page the new access token and keeps the rotated refresh token sealed', async () => {
    const { gh, callback } = await signedIn()
    const first = valueOf(cookieOf(callback, 'af_gh'))
    const response = await call(
      '/api/github/token',
      { method: 'POST', headers, cookie: `af_gh=${first}` },
      {},
      gh.fetchFn,
    )
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ token: 'ghu_access_1', expiresAt: 1_000_000 + 28800 * 1000 })
    const rotated = cookieOf(response, 'af_gh') ?? ''
    expect(valueOf(rotated)).not.toBe(first)
    expect(rotated).toContain('SameSite=Strict')
    expect(rotated).not.toContain('ghr_refresh_1')
    const refresh = JSON.parse(gh.seen.at(-1)?.body ?? '{}') as Record<string, string>
    expect(refresh).toMatchObject({
      grant_type: 'refresh_token',
      refresh_token: 'ghr_first',
      client_secret: 'the-client-secret',
    })
    // The next refresh uses the new one.
    await call(
      '/api/github/token',
      { method: 'POST', headers, cookie: `af_gh=${valueOf(rotated)}` },
      {},
      gh.fetchFn,
    )
    expect((JSON.parse(gh.seen.at(-1)?.body ?? '{}') as Record<string, string>)['refresh_token']).toBe(
      'ghr_refresh_1',
    )
  })

  it('is 401 and clears the cookie with none, or when GitHub refuses the refresh', async () => {
    const none = await call('/api/github/token', { method: 'POST', headers })
    expect(none.status).toBe(401)
    expect(cookieOf(none, 'af_gh')).toContain('Max-Age=0')
    const { callback } = await signedIn()
    const refused = github({ refusesRefresh: true })
    const response = await call(
      '/api/github/token',
      { method: 'POST', headers, cookie: `af_gh=${valueOf(cookieOf(callback, 'af_gh'))}` },
      {},
      refused.fetchFn,
    )
    expect(response.status).toBe(401)
    expect(cookieOf(response, 'af_gh')).toContain('Max-Age=0')
  })

  it('is 405 for a GET', async () => {
    expect((await call('/api/github/token', { headers })).status).toBe(405)
  })
})

describe('sign-out', () => {
  const headers = { origin: SITE, 'x-automata': '1' }

  it('revokes the one access token the page sends, never the grant, and clears the cookie', async () => {
    const gh = github()
    const response = await call(
      '/api/github/sign-out',
      { method: 'POST', headers, body: JSON.stringify({ token: 'ghu_access_1' }) },
      {},
      gh.fetchFn,
    )
    expect(response.status).toBe(204)
    expect(cookieOf(response, 'af_gh')).toContain('Max-Age=0')
    const revoke = gh.seen.at(-1)
    expect(revoke).toMatchObject({
      url: 'https://api.github.com/applications/Iv1.client/token',
      method: 'DELETE',
    })
    expect(JSON.parse(revoke?.body ?? '{}')).toEqual({ access_token: 'ghu_access_1' })
    expect(revoke?.auth).toBe(`Basic ${Buffer.from('Iv1.client:the-client-secret').toString('base64')}`)
    expect(gh.seen.some((seen) => seen.url.includes('/grant'))).toBe(false)
  })

  it('clears the cookie even when the page has no token to send', async () => {
    const gh = github()
    const response = await call('/api/github/sign-out', { method: 'POST', headers }, {}, gh.fetchFn)
    expect(response.status).toBe(204)
    expect(gh.seen).toEqual([])
  })

  it('needs the site’s Origin and X-Automata: 1', async () => {
    expect((await call('/api/github/sign-out', { method: 'POST' })).status).toBe(403)
  })
})

describe('every response', () => {
  it('is never cached, carries the site’s security headers, and never holds the client secret', async () => {
    const paths: [string, RequestInit][] = [
      ['/api/github/ping', {}],
      ['/api/github/start', {}],
      ['/api/github/callback?code=c&state=s', {}],
      ['/api/github/token', { method: 'POST' }],
      ['/api/github/sign-out', { method: 'POST' }],
      ['/api/github/nope', {}],
    ]
    for (const [path, init] of paths) {
      const response = await call(path, init)
      expect(response.headers.get('cache-control'), path).toBe('no-store')
      for (const [name, value] of Object.entries(securityHeaders(new URL(`${SITE}${path}`).pathname)))
        expect(response.headers.get(name), `${path} ${name}`).toBe(value)
      const text = `${[...response.headers.entries()].join('\n')}\n${await response.clone().text()}`
      expect(text, path).not.toContain('the-client-secret')
      expect(text, path).not.toContain(ENV.COOKIE_KEY)
    }
  })
})
