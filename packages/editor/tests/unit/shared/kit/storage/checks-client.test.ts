// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createChecksClient } from '#src/shared/kit/storage/checks-client.ts'

// The game's checks from the page: `automata editor` runs them where the game is, the page asks by id and sends the
// text it wants tried, and the token goes with the request as the store sends it.

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function server(answer: () => Response) {
  const sent: { url: string; method: string; auth: string | null; body: unknown }[] = []
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    sent.push({
      url: String(input),
      method: init?.method ?? 'GET',
      auth: new Headers(init?.headers).get('authorization'),
      body: init?.body === undefined ? undefined : JSON.parse(String(init.body)),
    })
    return answer()
  }) as typeof fetch
  return { sent, fetch: fetchFn }
}

const RESULT = {
  check: 'fair-play',
  status: 'pass',
  findings: [],
  measure: [{ id: 'm', label: 'a measure', value: 100, threshold: 100, ok: true }],
  output: '',
}

describe('createChecksClient', () => {
  it('asks the server to run the checks on the text it sends, with the token, and returns their results', async () => {
    const { sent, fetch } = server(() => json({ results: [RESULT] }))
    const client = createChecksClient({ base: 'http://127.0.0.1:4173', token: 'abc', fetch })
    const candidates = [{ path: 'content/systems/guard.toml', text: 'a = 1' }]
    expect(await client.run(['fair-play'], candidates, new AbortController().signal)).toEqual([RESULT])
    expect(sent).toEqual([
      {
        url: 'http://127.0.0.1:4173/api/checks/run',
        method: 'POST',
        auth: 'Bearer abc',
        body: { checks: ['fair-play'], candidates },
      },
    ])
  })

  it('says plainly when the server cannot be reached, or does not answer as a checks server', async () => {
    const stopped = createChecksClient({
      base: 'http://e',
      fetch: (async () => {
        throw new TypeError('Failed to fetch')
      }) as typeof fetch,
    })
    await expect(stopped.run(['fair-play'], [], new AbortController().signal)).rejects.toThrow(
      'The editor’s command has stopped. Start automata editor again, then try again.',
    )
    const refused = createChecksClient({
      base: 'http://e',
      fetch: server(() => json({ message: 'a token is needed' }, 401)).fetch,
    })
    await expect(refused.run(['fair-play'], [], new AbortController().signal)).rejects.toThrow(
      'a token is needed',
    )
  })
})
