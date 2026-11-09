import { mkdir, mkdtemp, readFile, realpath, rm, stat, symlink, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { Place } from '#src/features/editor/places/place.ts'
import { type RunningEditor, serveEditor } from '#src/features/editor/serve-editor.ts'

// `automata editor`'s server (ED3D.14, ED2D.9): the editor's static build and the checkout's files over `/api`, on the
// loopback unless asked, with a token off it, the editor list's allowlist and the mtime guard. Real HTTP against a real
// temporary folder, so every status below is what a tablet's browser would meet.

let root: string
let app: string
let running: RunningEditor | undefined

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'editor-root-'))
  app = await mkdtemp(join(tmpdir(), 'editor-app-'))
  await writeFile(join(app, 'index.html'), '<title>editor</title>')
  await mkdir(join(root, 'levels'), { recursive: true })
  await writeFile(join(root, 'levels/depot.af2d.json'), '{"a":1}')
  await writeFile(join(root, 'notes.txt'), 'not a level')
})

afterEach(async () => {
  await running?.close()
  running = undefined
  await rm(root, { recursive: true, force: true })
  await rm(app, { recursive: true, force: true })
})

const start = async (extra: Partial<Parameters<typeof serveEditor>[0]> = {}): Promise<RunningEditor> => {
  running = await serveEditor({ root, appDir: app, host: '127.0.0.1', port: 0, ...extra })
  return running
}

const api = (base: string, path: string, init?: RequestInit): Promise<Response> =>
  fetch(`${base}${path}`, init)

describe('serveEditor', () => {
  it('names the game in the ping by its folder, in words: my-cool-game is "My cool game"', async () => {
    const game = join(root, 'my-cool-game')
    await mkdir(game)
    const { url } = await start({ root: game })
    expect(await (await api(url, '/api/ping')).json()).toEqual({
      automata: 'editor',
      token: false,
      game: 'My cool game',
    })
  })

  it('names the game by the title its package.json gives, when it gives one', async () => {
    const game = join(root, 'base-3d')
    await mkdir(game)
    await writeFile(
      join(game, 'package.json'),
      '{"name":"@af-games/base-3d","automata":{"title":"Ember Hall"}}',
    )
    const { url } = await start({ root: game })
    expect(await (await api(url, '/api/ping')).json()).toMatchObject({ game: 'Ember Hall' })
  })

  it('falls back to the folder when package.json has no title or is not JSON', async () => {
    const game = join(root, 'my-cool-game')
    await mkdir(game)
    await writeFile(join(game, 'package.json'), '{"name":"x"}')
    const { url } = await start({ root: game })
    expect(await (await api(url, '/api/ping')).json()).toMatchObject({ game: 'My cool game' })
    await running?.close()
    await writeFile(join(game, 'package.json'), 'not json')
    const again = await start({ root: game })
    expect(await (await api(again.url, '/api/ping')).json()).toMatchObject({ game: 'My cool game' })
  })

  it("hands the game's dev page to the editor in the ping, for the Tuner's game pane", async () => {
    const { url } = await start({ gameUrl: 'http://localhost:5173/' })
    expect(await (await api(url, '/api/ping')).json()).toMatchObject({ gameUrl: 'http://localhost:5173/' })
  })

  it('serves the editor’s build, with a page for a path without a file', async () => {
    const { url } = await start()
    expect(await (await fetch(`${url}/`)).text()).toContain('<title>editor</title>')
    expect((await fetch(`${url}/nope.js`)).status).toBe(404)
  })

  it('answers a ping without a token, telling whether one is needed', async () => {
    const { url } = await start()
    expect(await (await api(url, '/api/ping')).json()).toMatchObject({ automata: 'editor', token: false })
  })

  it('lists the files the policy lets be read, with sizes and integer mtimes', async () => {
    const { url } = await start()
    const entries = (await (await api(url, '/api/list?prefix=')).json()) as {
      path: string
      size: number
      mtime: number
    }[]
    expect(entries.map((entry) => entry.path)).toEqual(['levels/depot.af2d.json'])
    expect(entries[0]?.size).toBe(7)
    expect(Number.isInteger(entries[0]?.mtime)).toBe(true)
  })

  it('reads a file, and says 404 for one that is not there', async () => {
    const { url } = await start()
    expect(await (await api(url, '/api/file?path=levels%2Fdepot.af2d.json')).text()).toBe('{"a":1}')
    expect((await api(url, '/api/file?path=levels%2Fmissing.af2d.json')).status).toBe(404)
  })

  it('writes with the mtime it was read with, and refuses a stale one with 409 and changes nothing', async () => {
    const { url } = await start()
    const [entry] = (await (await api(url, '/api/list?prefix=levels')).json()) as { mtime: number }[]
    const stale = await api(
      url,
      `/api/file?path=levels%2Fdepot.af2d.json&expected=${(entry?.mtime ?? 0) - 5}`,
      {
        method: 'PUT',
        body: '{"a":2}',
      },
    )
    expect(stale.status).toBe(409)
    expect(await readFile(join(root, 'levels/depot.af2d.json'), 'utf8')).toBe('{"a":1}')
    const fresh = await api(url, `/api/file?path=levels%2Fdepot.af2d.json&expected=${entry?.mtime}`, {
      method: 'PUT',
      body: '{"a":2}',
    })
    expect(fresh.status).toBe(200)
    expect(await readFile(join(root, 'levels/depot.af2d.json'), 'utf8')).toBe('{"a":2}')
    const { mtime } = (await fresh.json()) as { mtime: number }
    expect(mtime).toBe(Math.floor((await stat(join(root, 'levels/depot.af2d.json'))).mtimeMs))
  })

  it('creates a file only when it is absent', async () => {
    const { url } = await start()
    const made = await api(url, '/api/file?path=levels%2Fnew.af2d.json&expected=absent', {
      method: 'PUT',
      body: '{}',
    })
    expect(made.status).toBe(200)
    const again = await api(url, '/api/file?path=levels%2Fnew.af2d.json&expected=absent', {
      method: 'PUT',
      body: '{"x":1}',
    })
    expect(again.status).toBe(409)
    expect(await readFile(join(root, 'levels/new.af2d.json'), 'utf8')).toBe('{}')
  })

  it('removes a file, and a missing one is not an error', async () => {
    const { url } = await start()
    expect((await api(url, '/api/file?path=levels%2Fdepot.af2d.json', { method: 'DELETE' })).status).toBe(204)
    expect((await api(url, '/api/file?path=levels%2Fdepot.af2d.json', { method: 'DELETE' })).status).toBe(204)
  })

  it('refuses a path outside the checkout, a file the policy never allows, and a symlink out', async () => {
    const { url } = await start()
    expect((await api(url, '/api/file?path=..%2Fsecret')).status).toBe(403)
    expect((await api(url, '/api/file?path=%2Fetc%2Fpasswd')).status).toBe(403)
    expect((await api(url, '/api/file?path=notes.txt')).status).toBe(403)
    await mkdir(join(root, '.git'), { recursive: true })
    await writeFile(join(root, '.git/config.json'), '{}')
    expect((await api(url, '/api/file?path=.git%2Fconfig.json')).status).toBe(403)
    const outside = await mkdtemp(join(tmpdir(), 'editor-outside-'))
    await writeFile(join(outside, 'x.json'), '{"secret":true}')
    await symlink(outside, join(root, 'levels/escape'))
    expect((await api(url, '/api/file?path=levels%2Fescape%2Fx.json')).status).toBe(403)
    await rm(outside, { recursive: true, force: true })
  })

  it('takes its allowlist from content/editors.toml when the checkout has one', async () => {
    await mkdir(join(root, 'content'), { recursive: true })
    await writeFile(
      join(root, 'content/editors.toml'),
      [
        'format = "af-editors/1"',
        '',
        '[[file]]',
        'glob = "levels/**/*.json"',
        'editor = "levels-3d"',
        'modes = ["edit"]',
        'gates = []',
        'checks = ["content"]',
        '',
      ].join('\n'),
    )
    const { url } = await start()
    expect(
      (await api(url, '/api/file?path=levels%2Fdepot.af2d.json', { method: 'PUT', body: '{"a":3}' })).status,
    ).toBe(200)
    // The list itself is never written by an editor.
    expect(
      (await api(url, '/api/file?path=content%2Feditors.toml', { method: 'PUT', body: 'x' })).status,
    ).toBe(403)
  })

  describe('with a list that grows', () => {
    const LIST = [
      'format = "af-editors/1"',
      '',
      '[[file]]',
      'glob = "levels/**/*.json"',
      'editor = "levels-3d"',
      'modes = ["edit"]',
      'gates = []',
      'checks = ["content"]',
      '',
    ].join('\n')
    const FEEL = [
      '[[file]]',
      'glob = "content/feel/*.toml"',
      'editor = "feel"',
      'modes = ["edit"]',
      'gates = []',
      'checks = []',
      '',
    ].join('\n')
    const REFUSED = "The editors can only add to this game's list of editors."
    const put = (base: string, path: string, body: string) =>
      api(base, `/api/file?path=${encodeURIComponent(path)}`, { method: 'PUT', body })

    beforeEach(async () => {
      await mkdir(join(root, 'content'), { recursive: true })
      await writeFile(join(root, 'content/editors.toml'), LIST)
    })

    it('writes a list that only adds an editor’s own rows', async () => {
      const { url } = await start()
      const response = await put(url, 'content/editors.toml', `${LIST}\n${FEEL}`)
      expect(response.status).toBe(200)
      expect(await readFile(join(root, 'content/editors.toml'), 'utf8')).toContain('content/feel/*.toml')
    })

    it.each([
      ['removes a row', () => 'format = "af-editors/1"\n'],
      [
        'adds a row for a file a person never reaches',
        () => `${LIST}\n${FEEL.replace('content/feel/*.toml', 'vite.config.ts')}`,
      ],
      ['adds a check', () => `${LIST}\n${FEEL}\n[[check]]\nid = "x"\nrun = ["rm", "-rf", "."]\n`],
    ])('refuses a list that %s', async (_name, body) => {
      const { url } = await start()
      const response = await put(url, 'content/editors.toml', body())
      expect(response.status).toBe(403)
      expect((await response.json()).message).toBe(REFUSED)
      expect(await readFile(join(root, 'content/editors.toml'), 'utf8')).toBe(LIST)
    })

    it('writes a newly listed file without a restart, and the file list follows the new list', async () => {
      const { url } = await start()
      expect((await put(url, 'content/feel/feel.toml', 'x = 1')).status).toBe(403)
      await put(url, 'content/editors.toml', `${LIST}\n${FEEL}`)
      expect((await put(url, 'content/feel/feel.toml', 'x = 1')).status).toBe(200)
      const listed = (await (await api(url, '/api/list?prefix=content%2F')).json()) as { path: string }[]
      expect(listed.map((file) => file.path)).toContain('content/feel/feel.toml')
    })

    it('follows a hand edit of the list on disk, with no write through the server', async () => {
      await writeFile(join(root, 'content/editors.toml'), `${LIST}\n${FEEL}`)
      const { url } = await start()
      expect((await put(url, 'content/feel/feel.toml', 'x = 1')).status).toBe(200)
      // A person removes the row by hand while the editor runs: the file is no longer one it may write.
      await writeFile(join(root, 'content/editors.toml'), LIST)
      const later = new Date(Date.now() + 5000)
      await utimes(join(root, 'content/editors.toml'), later, later)
      const refused = await put(url, 'content/feel/feel.toml', 'x = 2')
      expect(refused.status).toBe(403)
      expect(await readFile(join(root, 'content/feel/feel.toml'), 'utf8')).toBe('x = 1')
    })

    it('never starts a list for a game with none', async () => {
      await rm(join(root, 'content/editors.toml'))
      const { url } = await start()
      expect((await put(url, 'content/editors.toml', `${LIST}\n${FEEL}`)).status).toBe(403)
    })

    it('keeps a policy it was given fixed', async () => {
      const { url } = await start({
        policy: { canRead: () => true, canWrite: (path) => path === 'notes.txt' },
      })
      expect((await put(url, 'content/editors.toml', `${LIST}\n${FEEL}`)).status).toBe(403)
      expect((await put(url, 'notes.txt', 'ok')).status).toBe(200)
    })
  })

  it('wants the token off the loopback, and the Host header of a loopback server to be a loopback name', async () => {
    const { url } = await start({ token: 'secret' })
    expect(await (await api(url, '/api/ping')).json()).toMatchObject({ automata: 'editor', token: true })
    expect((await api(url, '/api/list?prefix=')).status).toBe(401)
    expect((await api(url, '/api/list?prefix=', { headers: { authorization: 'Bearer wrong' } })).status).toBe(
      401,
    )
    expect(
      (await api(url, '/api/list?prefix=', { headers: { authorization: 'Bearer secret' } })).status,
    ).toBe(200)
  })

  it('refuses to listen beyond the loopback without a token', async () => {
    await expect(serveEditor({ root, appDir: app, host: '0.0.0.0', port: 0 })).rejects.toThrow(/token/)
  })

  it('refuses a request whose Host is not the server’s own on the loopback (DNS rebinding)', async () => {
    const { url } = await start()
    const port = new URL(url).port
    const response = await new Promise<number>((resolveStatus, reject) => {
      import('node:http').then(({ request }) => {
        const req = request(
          { host: '127.0.0.1', port, path: '/api/list?prefix=', headers: { host: 'evil.example' } },
          (res) => {
            resolveStatus(res.statusCode ?? 0)
            res.resume()
          },
        )
        req.on('error', reject)
        req.end()
      })
    })
    expect(response).toBe(403)
  })

  it('writes an mtime a later guarded write can use even when the clock has not moved', async () => {
    const { url } = await start()
    const first = (await (
      await api(url, '/api/file?path=levels%2Fa.af2d.json&expected=absent', { method: 'PUT', body: '1' })
    ).json()) as { mtime: number }
    await utimes(join(root, 'levels/a.af2d.json'), new Date(first.mtime), new Date(first.mtime))
    const second = await api(url, `/api/file?path=levels%2Fa.af2d.json&expected=${first.mtime}`, {
      method: 'PUT',
      body: '2',
    })
    expect(second.status).toBe(200)
  })
})

describe('serveEditor: Publish', () => {
  it('says in the ping whether it can publish the game', async () => {
    const plain = await start()
    expect(await (await api(plain.url, '/api/ping')).json()).not.toHaveProperty('publish')
    await plain.close()
    const { url } = await start({ publish: async () => ({ ok: true, file: join(root, 'game-itch.zip') }) })
    expect(await (await api(url, '/api/ping')).json()).toMatchObject({ publish: true })
  })

  it('says in the ping why Play is off, and names no game page', async () => {
    const { url } = await start({ playOff: 'Your game’s packages are not installed.' })
    const ping = (await (await api(url, '/api/ping')).json()) as Record<string, unknown>
    expect(ping.playOff).toBe('Your game’s packages are not installed.')
    expect(ping).not.toHaveProperty('gameUrl')
    const fine = await start()
    expect(await (await api(fine.url, '/api/ping')).json()).not.toHaveProperty('playOff')
  })

  it('publishes on a POST and then hands over the zip it made, as a download', async () => {
    const zip = join(root, 'my-game-0.1.0-itch.zip')
    await writeFile(zip, 'PK zip bytes')
    const { url } = await start({ publish: async () => ({ ok: true, file: zip }) })
    const early = await api(url, '/api/publish/file')
    expect(early.status).toBe(404)
    expect(await early.json()).toEqual({
      message: 'No zip has been made yet. Open Publish and press Make my zip.',
    })
    const done = await api(url, '/api/publish', { method: 'POST' })
    expect(done.status).toBe(200)
    expect(await done.json()).toEqual({ ok: true, name: 'my-game-0.1.0-itch.zip' })
    const file = await api(url, '/api/publish/file')
    expect(file.status).toBe(200)
    expect(file.headers.get('content-disposition')).toBe('attachment; filename="my-game-0.1.0-itch.zip"')
    expect(await file.text()).toBe('PK zip bytes')
  })

  it('passes on what stopped the game from publishing', async () => {
    const { url } = await start({
      publish: async () => ({
        ok: false,
        problem: 'Your game could not be put together.',
        detail: 'src/main.ts: oops',
      }),
    })
    const failed = await api(url, '/api/publish', { method: 'POST' })
    expect(await failed.json()).toEqual({
      ok: false,
      problem: 'Your game could not be put together.',
      detail: 'src/main.ts: oops',
    })
    expect((await api(url, '/api/publish/file')).status).toBe(404)
  })

  it('runs one publish at a time', async () => {
    let finish: () => void = () => {}
    const zip = join(root, 'game-itch.zip')
    const { url } = await start({
      publish: () =>
        new Promise((resolveDone) => {
          finish = () => resolveDone({ ok: true, file: zip })
        }),
    })
    const first = api(url, '/api/publish', { method: 'POST' })
    await new Promise((resolveSoon) => setTimeout(resolveSoon, 50))
    const second = await api(url, '/api/publish', { method: 'POST' })
    expect(second.status).toBe(409)
    expect(await second.json()).toEqual({
      message: 'Your game’s zip is already being made. Wait for it to finish.',
    })
    finish()
    expect((await first).status).toBe(200)
  })

  it('has no publish route when it cannot publish, and wants the token when it has one', async () => {
    const plain = await start()
    expect((await api(plain.url, '/api/publish', { method: 'POST' })).status).toBe(404)
    await plain.close()
    const { url } = await start({ token: 'tok', publish: async () => ({ ok: true, file: 'x' }) })
    expect((await api(url, '/api/publish', { method: 'POST' })).status).toBe(401)
  })
})

describe('serveEditor: where to put the zip', () => {
  const answered: { root: string; zip: string; answers: Record<string, string> }[] = []
  const place: Place = {
    id: 'fake',
    name: 'A fake place',
    asks: [{ id: 'page', label: 'Its page', example: 'a.b/c' }],
    put: async (where, zip, answers) => {
      answered.push({ root: where, zip, answers })
      return { ok: true, link: 'https://a.b/c' }
    },
    signIn: async () => ({ ok: true }),
  }
  const zipped = async () => {
    const zip = join(root, 'my-game-0.1.0-itch.zip')
    await writeFile(zip, 'PK')
    return zip
  }
  const post = (url: string, path: string, body: unknown = {}) =>
    api(url, path, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    })

  it('lists the places for the page, in order, without their code', async () => {
    const zip = await zipped()
    const { url } = await start({ publish: async () => ({ ok: true, file: zip }), places: [place] })
    expect(await (await api(url, '/api/places')).json()).toEqual([
      { id: 'fake', name: 'A fake place', asks: place.asks, signIn: true },
    ])
  })

  it('puts the zip Publish made in the place chosen, with the answers, and says how it went', async () => {
    const zip = await zipped()
    const { url } = await start({ publish: async () => ({ ok: true, file: zip }), places: [place] })
    await post(url, '/api/publish')
    const done = await post(url, '/api/places/fake', { answers: { page: 'a.b/c' } })
    expect(done.status).toBe(200)
    expect(await done.json()).toEqual({ ok: true, link: 'https://a.b/c' })
    expect(answered.at(-1)).toEqual({ root: await realpath(root), zip, answers: { page: 'a.b/c' } })
  })

  it('asks for the zip first, and knows its places', async () => {
    const zip = await zipped()
    const { url } = await start({ publish: async () => ({ ok: true, file: zip }), places: [place] })
    const early = await post(url, '/api/places/fake', { answers: {} })
    expect(early.status).toBe(409)
    expect(await early.json()).toEqual({ message: 'Make the zip first. Open Publish and press Make my zip.' })
    await post(url, '/api/publish')
    expect((await post(url, '/api/places/nowhere', { answers: {} })).status).toBe(404)
  })

  it('signs in at the place on this computer', async () => {
    const zip = await zipped()
    const { url } = await start({ publish: async () => ({ ok: true, file: zip }), places: [place] })
    const done = await post(url, '/api/places/fake/sign-in')
    expect(await done.json()).toEqual({ ok: true })
  })

  it('wants the token when it has one, and has no places when it cannot publish', async () => {
    const zip = await zipped()
    const tokened = await start({
      token: 'tok',
      publish: async () => ({ ok: true, file: zip }),
      places: [place],
    })
    expect((await api(tokened.url, '/api/places')).status).toBe(401)
    await tokened.close()
    const plain = await start({ places: [place] })
    expect((await api(plain.url, '/api/places')).status).toBe(404)
  })
})
