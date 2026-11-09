// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { createWebGitHubSession, githubApp, githubReady } from '#src/shared/kit/sync/web-sign-in.ts'

// The page's side of signing in with GitHub on the web (spec 7.2): the access token lives in memory, is renewed a minute
// before it ends through the site's function, and two tabs never spend the same rotating refresh token.

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

/** The site's function and GitHub's API as a fake `fetch`, remembering what it was asked. */
function site(options: { signedIn?: boolean } = {}) {
  const asked: { url: string; method: string; headers: Headers; body: string }[] = []
  let issued = 0
  let signedIn = options.signedIn ?? true
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    asked.push({
      url,
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
      body: String(init?.body ?? ''),
    })
    if (url === '/api/github/ping') return json({ github: 'ready', app: 'automata' })
    if (url === '/api/github/token') {
      if (!signedIn) return new Response(null, { status: 401 })
      issued += 1
      return json({ token: `ghu_${String(issued)}`, expiresAt: 10_000_000 + issued })
    }
    if (url === '/api/github/sign-out') {
      signedIn = false
      return new Response(null, { status: 204 })
    }
    if (url === 'https://api.github.com/user') return json({ login: 'mcthaydt' })
    return json({}, 500)
  }) as typeof fetch
  return { asked, fetchFn, tokenCalls: () => asked.filter((call) => call.url === '/api/github/token').length }
}

/** A Web Lock that runs one holder at a time, shared by sessions the way tabs of one browser share it. */
function fakeLocks() {
  let tail: Promise<unknown> = Promise.resolve()
  return {
    request: <T>(_name: string, callback: () => Promise<T>): Promise<T> => {
      const run = tail.then(callback)
      tail = run.catch(() => undefined)
      return run
    },
  } as unknown as LockManager
}

/** BroadcastChannels of one name, delivering to every other one at once. */
function fakeChannels() {
  const all = new Set<{ listeners: ((event: MessageEvent) => void)[] }>()
  return () => {
    const mine = { listeners: [] as ((event: MessageEvent) => void)[] }
    all.add(mine)
    return {
      postMessage(data: unknown) {
        for (const other of all)
          if (other !== mine) for (const listener of other.listeners) listener({ data } as MessageEvent)
      },
      addEventListener: (_type: string, listener: (event: MessageEvent) => void) =>
        void mine.listeners.push(listener),
      removeEventListener: () => undefined,
      close: () => undefined,
    } as unknown as BroadcastChannel
  }
}

function session(fetchFn: typeof fetch, extra: Record<string, unknown> = {}) {
  const navigated: string[] = []
  const made = createWebGitHubSession({
    fetch: fetchFn,
    now: () => 10_000_000 - 120_000,
    navigate: (url) => navigated.push(url),
    ...extra,
  })
  return { made, navigated }
}

describe('githubReady', () => {
  it('is true only when the function says ready', async () => {
    expect(await githubReady(site().fetchFn)).toBe(true)
    expect(await githubReady((async () => new Response(null, { status: 404 })) as typeof fetch)).toBe(false)
    expect(
      await githubReady((async () => {
        throw new TypeError('offline')
      }) as typeof fetch),
    ).toBe(false)
  })
})

describe('githubApp', () => {
  it('names the app the function signs in with, or nothing when sign-in is not set up', async () => {
    expect(await githubApp(site().fetchFn)).toBe('automata')
    expect(await githubApp((async () => new Response(null, { status: 404 })) as typeof fetch)).toBeUndefined()
    expect(
      await githubApp((async () => {
        throw new TypeError('offline')
      }) as typeof fetch),
    ).toBeUndefined()
  })
})

describe('token', () => {
  it('asks the function once, with the header it needs, and reuses the token until a minute before it ends', async () => {
    const fake = site()
    let now = 10_000_000 - 120_000
    const { made } = session(fake.fetchFn, { now: () => now })
    expect(await made.token()).toBe('ghu_1')
    expect(fake.asked[0]?.method).toBe('POST')
    expect(fake.asked[0]?.headers.get('x-automata')).toBe('1')
    expect(await made.token()).toBe('ghu_1')
    expect(fake.tokenCalls()).toBe(1)
    now = 10_000_001 - 59_000
    expect(await made.token()).toBe('ghu_2')
    expect(fake.tokenCalls()).toBe(2)
  })

  it('is nothing, and tells its listeners, when the function says the person is not signed in', async () => {
    const { made } = session(site({ signedIn: false }).fetchFn)
    const heard = vi.fn()
    made.subscribe(heard)
    expect(await made.token()).toBeUndefined()
    expect(heard).toHaveBeenCalled()
    expect(made.signedIn).toBe(false)
  })

  it('is nothing, and does not claim the person signed out, when the network fails', async () => {
    const { made } = session((async () => {
      throw new TypeError('offline')
    }) as typeof fetch)
    expect(await made.token()).toBeUndefined()
    expect(made.signedIn).toBeUndefined()
  })

  it('refreshes once when two tabs ask at the same time (Review Focus 2)', async () => {
    const fake = site()
    const locks = fakeLocks()
    const channel = fakeChannels()
    const a = session(fake.fetchFn, { locks, channel: channel() }).made
    const b = session(fake.fetchFn, { locks, channel: channel() }).made
    const [first, second] = await Promise.all([a.token(), b.token()])
    expect(fake.tokenCalls()).toBe(1)
    expect(first).toBe('ghu_1')
    expect(second).toBe('ghu_1')
  })

  it('writes nothing to any browser storage', async () => {
    const set = vi.spyOn(Storage.prototype, 'setItem')
    const { made } = session(site().fetchFn)
    await made.token()
    await made.login()
    await made.signOut()
    expect(set).not.toHaveBeenCalled()
    set.mockRestore()
  })
})

describe('login, sign in and sign out', () => {
  it('names the person from GitHub with the token, once', async () => {
    const fake = site()
    const { made } = session(fake.fetchFn)
    expect(await made.login()).toBe('mcthaydt')
    expect(await made.login()).toBe('mcthaydt')
    const user = fake.asked.filter((call) => call.url === 'https://api.github.com/user')
    expect(user).toHaveLength(1)
    expect(user[0]?.headers.get('authorization')).toBe('Bearer ghu_1')
  })

  it('sends the person to the function’s start, back to where they are', () => {
    const { made, navigated } = session(site().fetchFn)
    made.signIn('/editor/app/?games')
    expect(navigated).toEqual(['/api/github/start?back=%2Feditor%2Fapp%2F%3Fgames'])
  })

  it('signs out through the function with the token it holds, forgets it, and tells the other tabs', async () => {
    const fake = site()
    const channel = fakeChannels()
    const a = session(fake.fetchFn, { channel: channel() }).made
    const b = session(fake.fetchFn, { channel: channel() }).made
    await b.token()
    await a.token()
    const heard = vi.fn()
    b.subscribe(heard)
    await a.signOut()
    const out = fake.asked.find((call) => call.url === '/api/github/sign-out')
    expect(out?.headers.get('x-automata')).toBe('1')
    expect(JSON.parse(out?.body ?? '{}')).toEqual({ token: 'ghu_1' })
    expect(a.signedIn).toBe(false)
    expect(b.signedIn).toBe(false)
    expect(heard).toHaveBeenCalled()
  })
})
