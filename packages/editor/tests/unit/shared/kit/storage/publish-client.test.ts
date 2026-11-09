// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { createPublishClient } from '#src/shared/kit/storage/publish-client.ts'
import { openServedStore } from '#src/shared/kit/storage/workspace.ts'

// Publish from the editor: the server `automata editor` runs builds the game into a zip; the page asks it to and then
// fetches the zip, sending the token as the store does.

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function server(answers: Record<string, () => Response>) {
  const sent: { url: string; method: string; auth: string | null }[] = []
  const fetchFn = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    sent.push({ url, method: init?.method ?? 'GET', auth: new Headers(init?.headers).get('authorization') })
    const path = new URL(url).pathname
    return answers[path]?.() ?? json({ message: 'no such route' }, 404)
  }) as typeof fetch
  return { sent, fetch: fetchFn }
}

describe('createPublishClient', () => {
  it('asks the server to publish, with the token, and passes on the zip’s name', async () => {
    const { sent, fetch } = server({
      '/api/publish': () => json({ ok: true, name: 'my-game-0.1.0-itch.zip' }),
    })
    const client = createPublishClient({ base: 'http://127.0.0.1:4173', token: 'abc', fetch })
    expect(await client.publish()).toEqual({ ok: true, name: 'my-game-0.1.0-itch.zip' })
    expect(sent).toEqual([{ url: 'http://127.0.0.1:4173/api/publish', method: 'POST', auth: 'Bearer abc' }])
  })

  it('passes on what stopped the game, and says so plainly when the server cannot be reached', async () => {
    const failing = server({
      '/api/publish': () => json({ ok: false, problem: 'Your game did not build.', detail: 'oops' }),
    })
    expect(await createPublishClient({ base: 'http://e', fetch: failing.fetch }).publish()).toEqual({
      ok: false,
      problem: 'Your game did not build.',
      detail: 'oops',
    })
    const down = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    expect(await createPublishClient({ base: 'http://e', fetch: down }).publish()).toMatchObject({
      ok: false,
      problem: 'The editor’s command has stopped. Start automata editor again, then try again.',
    })
  })

  it('fetches the zip the server made', async () => {
    const { sent, fetch } = server({ '/api/publish/file': () => new Response('PK zip') })
    const zip = await createPublishClient({ base: 'http://e', token: 't', fetch }).zip()
    expect(await zip.text()).toBe('PK zip')
    expect(sent[0]).toMatchObject({ url: 'http://e/api/publish/file', auth: 'Bearer t' })
  })
})

describe('createPublishClient, places', () => {
  it('lists the places, and has none when the server does not know the route', async () => {
    const listed = server({
      '/api/places': () => json([{ id: 'itch', name: 'itch.io', asks: [], signIn: true }]),
    })
    expect(await createPublishClient({ base: 'http://e', token: 't', fetch: listed.fetch }).places()).toEqual(
      [{ id: 'itch', name: 'itch.io', asks: [], signIn: true }],
    )
    expect(listed.sent[0]).toMatchObject({ url: 'http://e/api/places', auth: 'Bearer t' })
    const older = server({})
    expect(await createPublishClient({ base: 'http://e', fetch: older.fetch }).places()).toEqual([])
  })

  it('sends the answers to the place and passes back its outcome', async () => {
    let body = ''
    const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      body = String(init?.body)
      expect(String(input)).toBe('http://e/api/places/itch')
      return json({ ok: false, need: 'account', problem: 'Connect first.' })
    }) as typeof globalThis.fetch
    const client = createPublishClient({ base: 'http://e', fetch })
    expect(await client.putInPlace('itch', { page: 'a/b' })).toEqual({
      ok: false,
      need: 'account',
      problem: 'Connect first.',
    })
    expect(JSON.parse(body)).toEqual({ answers: { page: 'a/b' } })
  })

  it('turns a refusal without a place’s shape into a sentence, and an unreachable server into the stopped words', async () => {
    const refused = server({ '/api/places/itch': () => json({ message: 'Make the zip first.' }, 409) })
    expect(
      await createPublishClient({ base: 'http://e', fetch: refused.fetch }).putInPlace('itch', {}),
    ).toEqual({
      ok: false,
      need: 'push',
      problem: 'Make the zip first.',
    })
    const down = (async () => {
      throw new TypeError('Failed to fetch')
    }) as typeof fetch
    expect(await createPublishClient({ base: 'http://e', fetch: down }).putInPlace('itch', {})).toMatchObject(
      {
        ok: false,
        problem: 'The editor’s command has stopped. Start automata editor again, then try again.',
      },
    )
    expect(await createPublishClient({ base: 'http://e', fetch: down }).signInAtPlace('itch')).toMatchObject({
      ok: false,
    })
  })

  it('signs in at the place', async () => {
    const { sent, fetch } = server({ '/api/places/itch/sign-in': () => json({ ok: true }) })
    expect(await createPublishClient({ base: 'http://e', fetch }).signInAtPlace('itch')).toEqual({ ok: true })
    expect(sent[0]).toMatchObject({ url: 'http://e/api/places/itch/sign-in', method: 'POST' })
  })
})

describe('openServedStore and Publish', () => {
  it('hands a publish client back only when the server says it can publish', async () => {
    const env = (ping: unknown) => ({
      origin: 'http://e',
      search: '',
      fetch: server({ '/api/ping': () => json(ping) }).fetch,
    })
    expect(
      (await openServedStore(env({ automata: 'editor', token: false, publish: true })))?.publish,
    ).toBeDefined()
    expect((await openServedStore(env({ automata: 'editor', token: false })))?.publish).toBeUndefined()
  })
})
