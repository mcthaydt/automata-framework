import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { type RunningEditor, serveEditor } from '#src/features/editor/serve-editor.ts'

// The Automata app's page is not served by this server: it runs from `tauri://localhost` (or `http://tauri.localhost`
// on Windows and Android) and calls the sidecar over HTTP. The server answers that page, and only that page, when the
// app names its origin. Origins are compared as the strings the browser sends, never through `new URL(...).origin`,
// which is "null" for a custom scheme.

const APP = 'tauri://localhost'
const TOKEN = 'secret-token'
let root: string
let app: string
let running: RunningEditor | undefined

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'editor-origin-root-'))
  app = await mkdtemp(join(tmpdir(), 'editor-origin-app-'))
  await writeFile(join(app, 'index.html'), '<title>editor</title>')
  await mkdir(join(root, 'levels'), { recursive: true })
  await writeFile(join(root, 'levels/depot.af2d.json'), '{"a":1}')
})

afterEach(async () => {
  await running?.close()
  running = undefined
  await rm(root, { recursive: true, force: true })
  await rm(app, { recursive: true, force: true })
})

const start = async (extra: Partial<Parameters<typeof serveEditor>[0]> = {}): Promise<RunningEditor> => {
  running = await serveEditor({ root, appDir: app, host: '127.0.0.1', port: 0, token: TOKEN, ...extra })
  return running
}

const put = (base: string, origin: string, headers: Record<string, string> = {}): Promise<Response> =>
  fetch(`${base}/api/file?path=levels%2Fdepot.af2d.json`, {
    method: 'PUT',
    body: '{"a":2}',
    headers: { origin, authorization: `Bearer ${TOKEN}`, ...headers },
  })

describe('serveEditor with appOrigins', () => {
  it("serves a write from the app's origin with the token, and says which origin may read the answer", async () => {
    const { url } = await start({ appOrigins: [APP] })
    const response = await put(url, APP)
    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBe(APP)
    expect(response.headers.get('vary')).toContain('Origin')
  })

  it('answers a preflight from the app with 204 and lets the token header through', async () => {
    const { url } = await start({ appOrigins: [APP] })
    const response = await fetch(`${url}/api/file?path=levels%2Fdepot.af2d.json`, {
      method: 'OPTIONS',
      headers: {
        origin: APP,
        'access-control-request-method': 'PUT',
        'access-control-request-headers': 'authorization',
      },
    })
    expect(response.status).toBe(204)
    expect(response.headers.get('access-control-allow-origin')).toBe(APP)
    expect(response.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('authorization')
    expect(response.headers.get('access-control-allow-methods')).toContain('PUT')
  })

  it('still needs the token from the app', async () => {
    const { url } = await start({ appOrigins: [APP] })
    const response = await fetch(`${url}/api/file?path=levels%2Fdepot.af2d.json`, {
      method: 'PUT',
      body: '{"a":2}',
      headers: { origin: APP },
    })
    expect(response.status).toBe(401)
  })

  it('refuses an origin that is not named, with or without the option', async () => {
    const { url } = await start({ appOrigins: [APP] })
    expect((await put(url, 'https://evil.example')).status).toBe(403)
    expect((await put(url, 'http://tauri.localhost')).status).toBe(403)
    expect(
      (
        await fetch(`${url}/api/file?path=levels%2Fdepot.af2d.json`, {
          method: 'OPTIONS',
          headers: { origin: 'https://evil.example' },
        })
      ).status,
    ).toBe(403)
  })

  it('refuses the app when the server was not told its origin', async () => {
    const { url } = await start()
    const response = await put(url, APP)
    expect(response.status).toBe(403)
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('gives no CORS header to a page on the same origin', async () => {
    const { url } = await start({ appOrigins: [APP] })
    const response = await put(url, new URL(url).origin)
    expect(response.status).toBe(200)
    expect(response.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('needs a token to name an origin, because that page can write files', async () => {
    await expect(
      serveEditor({ root, appDir: app, host: '127.0.0.1', port: 0, appOrigins: [APP] }),
    ).rejects.toThrow(/needs a token/)
  })
})
