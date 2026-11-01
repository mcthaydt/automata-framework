import { mkdir, mkdtemp, readFile, rm, stat, symlink, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type RunningEditor, serveEditor } from './serve-editor.ts'

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
  await writeFile(join(root, 'levels/depot.json'), '{"a":1}')
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
  it('serves the editor’s build, with a page for a path without a file', async () => {
    const { url } = await start()
    expect(await (await fetch(`${url}/`)).text()).toContain('<title>editor</title>')
    expect((await fetch(`${url}/nope.js`)).status).toBe(404)
  })

  it('answers a ping without a token, telling whether one is needed', async () => {
    const { url } = await start()
    expect(await (await api(url, '/api/ping')).json()).toEqual({ automata: 'editor', token: false })
  })

  it('lists the files the policy lets be read, with sizes and integer mtimes', async () => {
    const { url } = await start()
    const entries = (await (await api(url, '/api/list?prefix=')).json()) as {
      path: string
      size: number
      mtime: number
    }[]
    expect(entries.map((entry) => entry.path)).toEqual(['levels/depot.json'])
    expect(entries[0]?.size).toBe(7)
    expect(Number.isInteger(entries[0]?.mtime)).toBe(true)
  })

  it('reads a file, and says 404 for one that is not there', async () => {
    const { url } = await start()
    expect(await (await api(url, '/api/file?path=levels%2Fdepot.json')).text()).toBe('{"a":1}')
    expect((await api(url, '/api/file?path=levels%2Fmissing.json')).status).toBe(404)
  })

  it('writes with the mtime it was read with, and refuses a stale one with 409 and changes nothing', async () => {
    const { url } = await start()
    const [entry] = (await (await api(url, '/api/list?prefix=levels')).json()) as { mtime: number }[]
    const stale = await api(url, `/api/file?path=levels%2Fdepot.json&expected=${(entry?.mtime ?? 0) - 5}`, {
      method: 'PUT',
      body: '{"a":2}',
    })
    expect(stale.status).toBe(409)
    expect(await readFile(join(root, 'levels/depot.json'), 'utf8')).toBe('{"a":1}')
    const fresh = await api(url, `/api/file?path=levels%2Fdepot.json&expected=${entry?.mtime}`, {
      method: 'PUT',
      body: '{"a":2}',
    })
    expect(fresh.status).toBe(200)
    expect(await readFile(join(root, 'levels/depot.json'), 'utf8')).toBe('{"a":2}')
    const { mtime } = (await fresh.json()) as { mtime: number }
    expect(mtime).toBe(Math.floor((await stat(join(root, 'levels/depot.json'))).mtimeMs))
  })

  it('creates a file only when it is absent', async () => {
    const { url } = await start()
    const made = await api(url, '/api/file?path=levels%2Fnew.json&expected=absent', {
      method: 'PUT',
      body: '{}',
    })
    expect(made.status).toBe(200)
    const again = await api(url, '/api/file?path=levels%2Fnew.json&expected=absent', {
      method: 'PUT',
      body: '{"x":1}',
    })
    expect(again.status).toBe(409)
    expect(await readFile(join(root, 'levels/new.json'), 'utf8')).toBe('{}')
  })

  it('removes a file, and a missing one is not an error', async () => {
    const { url } = await start()
    expect((await api(url, '/api/file?path=levels%2Fdepot.json', { method: 'DELETE' })).status).toBe(204)
    expect((await api(url, '/api/file?path=levels%2Fdepot.json', { method: 'DELETE' })).status).toBe(204)
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
      (await api(url, '/api/file?path=levels%2Fdepot.json', { method: 'PUT', body: '{"a":3}' })).status,
    ).toBe(200)
    // The list itself is never written by an editor.
    expect(
      (await api(url, '/api/file?path=content%2Feditors.toml', { method: 'PUT', body: 'x' })).status,
    ).toBe(403)
  })

  it('wants the token off the loopback, and the Host header of a loopback server to be a loopback name', async () => {
    const { url } = await start({ token: 'secret' })
    expect(await (await api(url, '/api/ping')).json()).toEqual({ automata: 'editor', token: true })
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
      await api(url, '/api/file?path=levels%2Fa.json&expected=absent', { method: 'PUT', body: '1' })
    ).json()) as { mtime: number }
    await utimes(join(root, 'levels/a.json'), new Date(first.mtime), new Date(first.mtime))
    const second = await api(url, `/api/file?path=levels%2Fa.json&expected=${first.mtime}`, {
      method: 'PUT',
      body: '2',
    })
    expect(second.status).toBe(200)
  })
})
