// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { openServedStore, openServedWorkspace } from '#src/shared/kit/storage/workspace.ts'

// Opening the editor from `automata editor`: the page asks the server it came from whether it is one, and
// takes the checkout as its workspace; otherwise it is a plain page and the editor opens its own storage as before.

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function page(
  search = '',
  ping: () => Response | Promise<Response> = () => json({ automata: 'editor', token: false }),
) {
  const stored = new Map<string, string>()
  const sent: { url: string; auth: string | null }[] = []
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    sent.push({ url: String(input), auth: new Headers(init?.headers).get('authorization') })
    if (String(input).endsWith('/api/ping')) return ping()
    return json([])
  }) as typeof fetch
  return {
    sent,
    stored,
    env: {
      origin: 'http://tablet.local:4173',
      search,
      fetch: fetchFn,
      sessionStorage: {
        getItem: (key: string) => stored.get(key) ?? null,
        setItem: (key: string, value: string) => void stored.set(key, value),
      },
      storage: {},
    },
  }
}

describe('openServedWorkspace', () => {
  it('is a workspace over the server the page came from, persistent, with a journal of its own', async () => {
    const { env } = page()
    const workspace = await openServedWorkspace(env)
    expect(workspace?.store.kind).toBe('http')
    expect(workspace?.persistent).toBe(true)
    expect(workspace?.journal.kind).not.toBe('http')
  })

  it('carries the game’s name from the ping, and none from a server too old to send one', async () => {
    const named = page('', () => json({ automata: 'editor', token: false, game: 'Emberwick' }))
    expect((await openServedWorkspace(named.env))?.game).toBe('Emberwick')
    expect((await openServedWorkspace(page().env))?.game).toBeUndefined()
  })

  it("carries the game's dev page from the ping, and none for one that is not a web address", async () => {
    const served = page('', () =>
      json({ automata: 'editor', token: false, gameUrl: 'http://localhost:5173/' }),
    )
    expect((await openServedStore(served.env))?.gameUrl).toBe('http://localhost:5173/')
    const odd = page('', () => json({ automata: 'editor', token: false, gameUrl: 'not an address' }))
    expect((await openServedStore(odd.env))?.gameUrl).toBeUndefined()
  })

  it('is nothing when the origin is not an editor server (a plain page)', async () => {
    const { env } = page('', () => new Response('<html>', { status: 200 }))
    expect(await openServedWorkspace(env)).toBeUndefined()
    const down = page('', () => {
      throw new TypeError('Failed to fetch')
    })
    expect(await openServedWorkspace(down.env)).toBeUndefined()
  })

  it('takes the token from the address, keeps it for the session and sends it', async () => {
    const first = page('?token=abc')
    const workspace = await openServedWorkspace(first.env)
    await workspace?.store.list()
    expect(first.sent.at(-1)?.auth).toBe('Bearer abc')
    expect(first.stored.get('automata-editor-token')).toBe('abc')
    // A reload without the token in the address finds it again.
    const second = page('')
    second.stored.set('automata-editor-token', 'abc')
    const again = await openServedWorkspace(second.env)
    await again?.store.list()
    expect(second.sent.at(-1)?.auth).toBe('Bearer abc')
  })
})
