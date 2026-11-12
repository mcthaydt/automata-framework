import { describe, expect, it } from 'vitest'
import { missingDesktopTools, startTauriSession } from '#src/desktop/webdriver.ts'

/** A fetch that answers from `reply` and records each request as `METHOD path body`. */
function fakeFetch(
  reply: (method: string, path: string, body: unknown) => { status?: number; value: unknown },
) {
  const requests: string[] = []
  const fetcher = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    const path = new URL(String(url)).pathname
    const method = init?.method ?? 'GET'
    const body = init?.body === undefined ? undefined : JSON.parse(String(init.body))
    requests.push(`${method} ${path}${body === undefined ? '' : ` ${JSON.stringify(body)}`}`)
    const answer = reply(method, path, body)
    return new Response(JSON.stringify({ value: answer.value }), { status: answer.status ?? 200 })
  }
  return { fetcher, requests }
}

describe('startTauriSession', () => {
  it('starts the app through tauri:options, runs scripts in its window, and ends the session', async () => {
    const { fetcher, requests } = fakeFetch((method, path) => {
      if (method === 'POST' && path === '/session') return { value: { sessionId: 's1' } }
      if (path === '/session/s1/execute/sync') return { value: 'ready' }
      return { value: null }
    })
    const session = await startTauriSession('/app/my-game', { base: 'http://127.0.0.1:4444', fetcher })
    expect(await session.execute('return document.documentElement.dataset.state')).toBe('ready')
    await session.end()
    expect(requests).toEqual([
      'POST /session {"capabilities":{"alwaysMatch":{"tauri:options":{"application":"/app/my-game"}}}}',
      'POST /session/s1/execute/sync {"script":"return document.documentElement.dataset.state","args":[]}',
      'DELETE /session/s1',
    ])
  })

  it("fails with the driver's own words when it refuses", async () => {
    const { fetcher } = fakeFetch(() => ({
      status: 500,
      value: { error: 'session not created', message: 'no app' },
    }))
    await expect(startTauriSession('/nope', { base: 'http://127.0.0.1:4444', fetcher })).rejects.toThrow(
      /session not created.*no app/,
    )
  })

  it('fails naming the call when the driver does not answer in time, instead of hanging the journey', async () => {
    // A driver that takes the connection and never answers; it stops only when the request is aborted.
    const fetcher = (_url: string | URL | Request, init?: RequestInit): Promise<Response> =>
      new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason))
      })
    await expect(
      startTauriSession('/app', { base: 'http://127.0.0.1:4444', fetcher, requestTimeoutMs: 20 }),
    ).rejects.toThrow(/WebDriver POST \/session did not answer within 20 ms/)
  })

  it('names the call when the driver answers with something that is not JSON', async () => {
    const fetcher = async (): Promise<Response> => new Response('Bad Gateway', { status: 502 })
    await expect(startTauriSession('/app', { base: 'http://127.0.0.1:4444', fetcher })).rejects.toThrow(
      /WebDriver POST \/session failed: 502 Bad Gateway/,
    )
  })

  it('waits until a script answers truthy, and names the script when it never does', async () => {
    let calls = 0
    const { fetcher } = fakeFetch((method, path) => {
      if (method === 'POST' && path === '/session') return { value: { sessionId: 's1' } }
      calls += 1
      return { value: calls >= 3 }
    })
    const session = await startTauriSession('/app', { base: 'http://127.0.0.1:4444', fetcher, pollMs: 1 })
    expect(await session.until('return ok', 1_000)).toBe(true)
    expect(calls).toBe(3)
    calls = -1_000_000
    await expect(session.until('return never', 20)).rejects.toThrow(/return never/)
  })
})

describe('missingDesktopTools', () => {
  it('names each missing tool with the command that installs it', () => {
    const present = new Set(['Xvfb', 'openbox'])
    expect(missingDesktopTools((tool) => present.has(tool))).toEqual([
      'wmctrl: sudo apt install wmctrl',
      'WebKitWebDriver: sudo apt install webkit2gtk-driver',
      'tauri-driver: cargo install tauri-driver@2.1.0 --locked',
    ])
  })

  it('is empty when every tool is there', () => {
    expect(missingDesktopTools(() => true)).toEqual([])
  })
})
