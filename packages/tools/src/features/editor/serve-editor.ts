// `automata editor`'s server (ED3D.14, ED2D.9): the editor's static build, and the game checkout's files under `/api` for
// the kit's HTTP store (`createHttpStore`, which documents the four routes). It listens on the loopback unless told to
// listen wider, and then it insists on a token; on the loopback it refuses a `Host` that is not a loopback name (DNS
// rebinding) and a cross-origin write. What a browser may read and write is the policy's (`editor-policy.ts`), and every
// path is resolved through real paths, so a symlink cannot lead out of the checkout. A guarded write is the mtime check
// the kit's stores have; the check and the write are two steps, as the kit says of its own browser stores.
import { timingSafeEqual } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { mkdir, open, readdir, readFile, realpath, rm, stat, writeFile } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { type EditorPolicy, editorPolicy } from './editor-policy.ts'

export interface EditorServerOptions {
  /** The game checkout the editor reads and writes. */
  readonly root: string
  /** The editor's static build (a folder with an `index.html`). */
  readonly appDir: string
  /** The address to listen on; the loopback by default. Anything else needs `token`. */
  readonly host?: string | undefined
  /** 0 picks a free port. */
  readonly port?: number | undefined
  /** Required off the loopback: the API answers 401 without `Authorization: Bearer <token>`. */
  readonly token?: string | undefined
  /** What may be touched; the checkout's editor list decides when this is left out. */
  readonly policy?: EditorPolicy | undefined
}

export interface RunningEditor {
  /** Where the editor is: `http://<host>:<port>`. */
  readonly url: string
  readonly port: number
  close(): Promise<void>
}

const MAX_BODY_BYTES = 16 * 1024 * 1024
const LOOPBACK_NAMES = new Set(['127.0.0.1', 'localhost', '[::1]', '::1'])
const OWNED = new Set(['.git', 'node_modules', 'dist', '.vitest', '.claude', '.github'])
const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
  '.map': 'application/json; charset=utf-8',
}

const isLoopback = (host: string): boolean => host === '127.0.0.1' || host === 'localhost' || host === '::1'

const reply = (res: ServerResponse, status: number, body: unknown): void => {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}

const mtimeOf = (info: { readonly mtimeMs: number }): number => Math.floor(info.mtimeMs)

function sameToken(given: string | undefined, token: string): boolean {
  if (given === undefined) return false
  const a = Buffer.from(given)
  const b = Buffer.from(token)
  return a.length === b.length && timingSafeEqual(a, b)
}

async function readBody(req: IncomingMessage): Promise<Buffer | undefined> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const part = chunk as Buffer
    size += part.length
    if (size > MAX_BODY_BYTES) return undefined
    chunks.push(part)
  }
  return Buffer.concat(chunks)
}

export async function serveEditor(options: EditorServerOptions): Promise<RunningEditor> {
  const host = options.host ?? '127.0.0.1'
  const { token } = options
  if (!isLoopback(host) && token === undefined)
    throw new Error('listening beyond the loopback needs a token: the editor writes files')
  const root = await realpath(options.root)
  const appDir = await realpath(options.appDir)
  const policy =
    options.policy ??
    editorPolicy(await readFile(join(root, 'content/editors.toml'), 'utf8').catch(() => undefined))

  /** `root`/`path` when its real location is inside the checkout (the deepest existing part is checked), else undefined. */
  async function locate(path: string): Promise<string | undefined> {
    const full = resolve(root, path)
    let probe = full
    for (;;) {
      try {
        const real = await realpath(probe)
        return real === root || real.startsWith(root + sep) ? full : undefined
      } catch {
        const parent = dirname(probe)
        if (parent === probe) return undefined
        probe = parent
      }
    }
  }

  async function walk(
    dir: string,
    relative: string,
    out: { path: string; size: number; mtime: number }[],
  ): Promise<void> {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.isSymbolicLink() || OWNED.has(entry.name)) continue
      const path = relative === '' ? entry.name : `${relative}/${entry.name}`
      if (entry.isDirectory()) await walk(join(dir, entry.name), path, out)
      else if (entry.isFile() && policy.canRead(path)) {
        const info = await stat(join(dir, entry.name))
        out.push({ path, size: info.size, mtime: mtimeOf(info) })
      }
    }
  }

  async function api(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
    if (url.pathname === '/api/ping')
      return reply(res, 200, { automata: 'editor', token: token !== undefined })
    if (token !== undefined) {
      const bearer = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1]
      if (!sameToken(bearer, token))
        return reply(res, 401, { message: 'a token is needed: open the address the command printed' })
    }
    const method = req.method ?? 'GET'
    if (url.pathname === '/api/list' && method === 'GET') {
      const prefix = url.searchParams.get('prefix') ?? ''
      const entries: { path: string; size: number; mtime: number }[] = []
      await walk(root, '', entries)
      return reply(
        res,
        200,
        entries
          .filter((entry) => entry.path.startsWith(prefix))
          .sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)),
      )
    }
    if (url.pathname !== '/api/file') return reply(res, 404, { message: 'no such route' })
    const path = url.searchParams.get('path') ?? ''
    const write = method === 'PUT' || method === 'DELETE'
    if (!(write ? policy.canWrite(path) : policy.canRead(path)))
      return reply(res, 403, {
        message: `${path === '' ? 'that path' : path} is not one the editor may ${write ? 'write' : 'read'}`,
      })
    const full = await locate(path)
    if (full === undefined) return reply(res, 403, { message: `${path} leads outside the checkout` })

    if (method === 'GET') {
      const info = await stat(full).catch(() => undefined)
      if (info === undefined || !info.isFile()) return reply(res, 404, { message: `no file ${path}` })
      res.writeHead(200, { 'content-type': 'application/octet-stream', 'cache-control': 'no-store' })
      createReadStream(full).pipe(res)
      return
    }
    if (method === 'DELETE') {
      await rm(full, { force: true })
      res.writeHead(204)
      res.end()
      return
    }
    if (method !== 'PUT') return reply(res, 405, { message: 'method not allowed' })
    const body = await readBody(req)
    if (body === undefined) return reply(res, 413, { message: 'the file is over 16 MB' })
    const expected = url.searchParams.get('expected')
    const current = await stat(full).catch(() => undefined)
    if (expected === 'absent') {
      if (current !== undefined) return reply(res, 409, { message: `${path} is there already` })
      await mkdir(dirname(full), { recursive: true })
      try {
        const handle = await open(full, 'wx')
        await handle.writeFile(body)
        await handle.close()
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST')
          return reply(res, 409, { message: `${path} is there already` })
        throw error
      }
    } else {
      if (expected !== null && (current === undefined || mtimeOf(current) !== Number(expected)))
        return reply(res, 409, { message: `${path} changed on disk since the editor read it` })
      await mkdir(dirname(full), { recursive: true })
      await writeFile(full, body)
    }
    return reply(res, 200, { mtime: mtimeOf(await stat(full)) })
  }

  async function files(res: ServerResponse, pathname: string): Promise<void> {
    const wanted = pathname === '/' ? '/index.html' : pathname
    const full = resolve(appDir, `.${decodeURIComponent(wanted)}`)
    const known = full.startsWith(appDir + sep) ? await stat(full).catch(() => undefined) : undefined
    const target =
      known?.isFile() === true ? full : extname(wanted) === '' ? join(appDir, 'index.html') : undefined
    if (target === undefined) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('not found')
      return
    }
    res.writeHead(200, { 'content-type': TYPES[extname(target)] ?? 'application/octet-stream' })
    createReadStream(target).pipe(res)
  }

  const server: Server = createServer((req, res) => {
    void (async () => {
      try {
        const url = new URL(req.url ?? '/', 'http://editor')
        const hostName = (req.headers.host ?? '').replace(/:\d+$/, '')
        if (isLoopback(host) && !LOOPBACK_NAMES.has(hostName))
          return reply(res, 403, { message: 'this server answers only to its own loopback address' })
        const origin = req.headers.origin
        if (
          req.method !== 'GET' &&
          req.method !== 'HEAD' &&
          origin !== undefined &&
          new URL(origin).host !== req.headers.host
        )
          return reply(res, 403, { message: 'a page from another origin may not change files' })
        if (url.pathname.startsWith('/api/')) return await api(req, res, url)
        return await files(res, url.pathname)
      } catch (error) {
        if (!res.headersSent)
          reply(res, 500, { message: error instanceof Error ? error.message : String(error) })
        else res.end()
      }
    })()
  })

  await new Promise<void>((resolveListening, reject) => {
    server.once('error', reject)
    server.listen(options.port ?? 0, host, resolveListening)
  })
  const port = (server.address() as AddressInfo).port
  return {
    url: `http://${host === '0.0.0.0' || host === '::' ? 'localhost' : host === '::1' ? '[::1]' : host}:${port}`,
    port,
    close: () =>
      new Promise<void>((resolveClosed) => {
        server.closeAllConnections()
        server.close(() => resolveClosed())
      }),
  }
}
