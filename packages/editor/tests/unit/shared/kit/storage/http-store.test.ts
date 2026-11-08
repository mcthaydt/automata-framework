import { describe, expect, it } from 'vitest'
import { createHttpStore } from '#src/shared/kit/storage/http-store.ts'
import { StorageError } from '#src/shared/kit/storage/project-store.ts'

// The store of a served game checkout: the kit's `ProjectStore` over HTTP, with the server's
// mtime guard. Run against a scripted `fetch`, so the requests it sends and the failures it sorts are exactly these.

interface Sent {
  readonly method: string
  readonly url: string
  readonly auth: string | null
  readonly body: unknown
  readonly keepalive: boolean | undefined
}

function scripted(reply: (sent: Sent) => Response | Promise<Response>) {
  const sent: Sent[] = []
  const fetchFn = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request: Sent = {
      method: init?.method ?? 'GET',
      url: String(input),
      auth: new Headers(init?.headers).get('authorization'),
      body: init?.body,
      keepalive: init?.keepalive,
    }
    sent.push(request)
    return reply(request)
  }
  return { sent, fetchFn: fetchFn as typeof fetch }
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('createHttpStore', () => {
  it('lists with a prefix, and sends the token as a bearer', async () => {
    const { sent, fetchFn } = scripted(() => json(200, [{ path: 'levels/a.json', size: 3, mtime: 7 }]))
    const store = createHttpStore({ base: 'http://host:5000', token: 'abc', fetch: fetchFn })
    expect(await store.list('levels/')).toEqual([{ path: 'levels/a.json', size: 3, mtime: 7 }])
    expect(sent[0]?.url).toBe('http://host:5000/api/list?prefix=levels%2F')
    expect(sent[0]?.auth).toBe('Bearer abc')
    expect(store.kind).toBe('http')
  })

  it('reads a file’s bytes, and a missing file as undefined', async () => {
    const { fetchFn } = scripted((sent) =>
      sent.url.includes('missing')
        ? json(404, { message: 'no such file' })
        : new Response(new Uint8Array([1, 2, 3])),
    )
    const store = createHttpStore({ base: 'http://host', fetch: fetchFn })
    expect([...((await store.read('a.json')) ?? [])]).toEqual([1, 2, 3])
    expect(await store.read('missing.json')).toBeUndefined()
  })

  it('writes with the mtime it expects, or "absent" for a new file, and returns the new mtime', async () => {
    const { sent, fetchFn } = scripted(() => json(200, { mtime: 99 }))
    const store = createHttpStore({ base: 'http://host', fetch: fetchFn })
    expect(await store.write('a.json', 'hi', { mtime: 5 })).toEqual({ ok: true, mtime: 99 })
    expect(await store.write('b.json', new Uint8Array([1]), 'absent')).toEqual({ ok: true, mtime: 99 })
    expect(await store.write('c.json', 'x')).toEqual({ ok: true, mtime: 99 })
    expect(sent.map((each) => [each.method, each.url])).toEqual([
      ['PUT', 'http://host/api/file?path=a.json&expected=5'],
      ['PUT', 'http://host/api/file?path=b.json&expected=absent'],
      ['PUT', 'http://host/api/file?path=c.json'],
    ])
  })

  // The page may be going away (a closed tab, a phone put to sleep): a keepalive request finishes after it.
  it('sends a small write as a keepalive request, so a page that is going away still lands it', async () => {
    const { sent, fetchFn } = scripted(() => json(200, { mtime: 9 }))
    const store = createHttpStore({ base: 'http://host', token: 't', fetch: fetchFn })
    await store.write('a.toml', new TextEncoder().encode('flash = 1'))
    expect(sent[0]?.keepalive).toBe(true)
    await store.write('big.json', new Uint8Array(70_000))
    expect(sent[1]?.keepalive).toBeFalsy()
  })

  it('answers a conflict, a refusal by policy and a failure as the kit’s own reasons', async () => {
    const replies = [
      json(409, { message: 'the file changed' }),
      json(403, { message: 'not in the editor list' }),
      json(401, { message: 'a token is needed' }),
      json(500, { message: 'disk full' }),
    ]
    const { fetchFn } = scripted(() => replies.shift() as Response)
    const store = createHttpStore({ base: 'http://host', fetch: fetchFn })
    expect(await store.write('a', 'x', { mtime: 1 })).toEqual({
      ok: false,
      reason: 'conflict',
      message: 'the file changed',
    })
    expect(await store.write('a', 'x')).toEqual({
      ok: false,
      reason: 'policy',
      message: 'not in the editor list',
    })
    expect(await store.write('a', 'x')).toEqual({ ok: false, reason: 'denied', message: 'a token is needed' })
    expect(await store.write('a', 'x')).toEqual({ ok: false, reason: 'io', message: 'disk full' })
  })

  it('rejects a read or a listing the server refuses with a StorageError, and a network failure as io', async () => {
    const { fetchFn } = scripted(() => json(403, { message: 'nope' }))
    const refused = createHttpStore({ base: 'http://host', fetch: fetchFn })
    await expect(refused.list()).rejects.toMatchObject({ reason: 'policy' })
    const down = createHttpStore({
      base: 'http://host',
      fetch: (async () => {
        throw new TypeError('Failed to fetch')
      }) as typeof fetch,
    })
    await expect(down.read('a')).rejects.toBeInstanceOf(StorageError)
    await expect(down.read('a')).rejects.toMatchObject({ reason: 'io' })
    expect(await down.write('a', 'x')).toMatchObject({ ok: false, reason: 'io' })
  })

  it('removes a file', async () => {
    const { sent, fetchFn } = scripted(() => new Response(null, { status: 204 }))
    await createHttpStore({ base: 'http://host/', fetch: fetchFn }).remove('a.json')
    expect(sent[0]).toMatchObject({ method: 'DELETE', url: 'http://host/api/file?path=a.json' })
  })

  it('refuses a path no store can name before sending anything', async () => {
    const { sent, fetchFn } = scripted(() => json(200, []))
    const store = createHttpStore({ base: 'http://host', fetch: fetchFn })
    await expect(store.read('../secret')).rejects.toThrow()
    expect(sent).toEqual([])
  })
})
