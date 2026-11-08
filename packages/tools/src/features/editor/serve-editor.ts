// `automata editor`'s server: the editor's static build, and the game checkout's files under `/api` for
// the kit's HTTP store (`createHttpStore`, which documents the four routes; the checkout's files are `checkout.ts`). It listens on the loopback unless told to
// listen wider, and then it insists on a token; on the loopback it refuses a `Host` that is not a loopback name (DNS
// rebinding) and a cross-origin write. What a browser may read and write is the policy's (`editor-policy.ts`), and every
// path is resolved through real paths, so a symlink cannot lead out of the checkout. A guarded write is the mtime check
// the kit's stores have; the check and the write are two steps, as the kit says of its own browser stores.
import { timingSafeEqual } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { readFile, realpath, rm, stat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { basename, extname, join, resolve, sep } from 'node:path'
import { type Checkout, openCheckout } from './checkout.ts'
import { type EditorPolicy, editorPolicy } from './editor-policy.ts'
import { openWatcher, WATCH_DEBOUNCE_MS, type Watcher } from './watch.ts'

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
  /** The game's dev page, handed to the editor in the ping for the Tuner's game pane. The server never fetches it. */
  readonly gameUrl?: string | undefined
  /** What may be touched; the checkout's editor list decides when this is left out. */
  readonly policy?: EditorPolicy | undefined
  /**
   * Origins, exactly as a browser sends them (`tauri://localhost`), of pages this server does not serve that may call
   * it: the Automata app's. They get CORS headers and may write, and still need the token, so naming one needs a token.
   */
  readonly appOrigins?: readonly string[] | undefined
  /** How long a file must be still before `/api/watch` reports it; a test shortens it. */
  readonly watchDebounceMs?: number | undefined
}

export interface RunningEditor {
  /** Where the editor is: `http://<host>:<port>`. */
  readonly url: string
  readonly port: number
  close(): Promise<void>
}

const MAX_BODY_BYTES = 16 * 1024 * 1024
const LOOPBACK_NAMES = new Set(['127.0.0.1', 'localhost', '[::1]', '::1'])
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

/** `/api/file`: read (GET), delete (DELETE) or write (PUT) one file the policy allows, inside the checkout. */
async function fileRoute(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  policy: EditorPolicy,
  checkout: Checkout,
): Promise<void> {
  const method = req.method ?? 'GET'
  const path = url.searchParams.get('path') ?? ''
  const write = method === 'PUT' || method === 'DELETE'
  if (!(write ? policy.canWrite(path) : policy.canRead(path)))
    return reply(res, 403, {
      message: `${path === '' ? 'that path' : path} is not one the editor may ${write ? 'write' : 'read'}`,
    })
  const full = await checkout.locate(path)
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
  const outcome = await checkout.write(full, path, body, url.searchParams.get('expected'))
  if ('conflict' in outcome) return reply(res, 409, { message: outcome.conflict })
  return reply(res, 200, { mtime: outcome.mtime })
}

/**
 * What Home calls the game: its folder's name in words ("emberwick" is "Emberwick", "my-cool-game" is "My cool
 * game"). The folder is the one name every game has whatever its targets; a title lives in a target's own config.
 */
function gameName(root: string): string {
  const words = basename(root).replace(/[-_]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** What the ping tells the editor: the game's name and, when there is one, its dev page. */
interface PingFacts {
  readonly game: string
  readonly gameUrl?: string | undefined
}

/** The `/api` routes: ping (with the game's name), list and file; a token is checked first when the server has one. */
async function api(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  token: string | undefined,
  policy: EditorPolicy,
  checkout: Checkout,
  facts: PingFacts,
  watcher: Watcher,
): Promise<void> {
  if (url.pathname === '/api/ping')
    return reply(res, 200, { automata: 'editor', token: token !== undefined, ...facts })
  if (token !== undefined) {
    const bearer = /^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1]
    if (!sameToken(bearer, token))
      return reply(res, 401, { message: 'a token is needed: open the address the command printed' })
  }
  if (url.pathname === '/api/list' && req.method === 'GET') {
    return reply(res, 200, await checkout.list(url.searchParams.get('prefix') ?? ''))
  }
  if (url.pathname === '/api/watch' && req.method === 'GET') return watchRoute(req, res, watcher)
  if (url.pathname !== '/api/file') return reply(res, 404, { message: 'no such route' })
  return fileRoute(req, res, url, policy, checkout)
}

/** `/api/watch`: server-sent events, one `data:` line of JSON per changed file, until the client leaves. */
function watchRoute(req: IncomingMessage, res: ServerResponse, watcher: Watcher): void {
  res.writeHead(200, {
    'content-type': 'text/event-stream; charset=utf-8',
    'cache-control': 'no-store',
    connection: 'keep-alive',
  })
  // A comment line, so the client's `fetch` resolves now and not at the first change.
  res.write(': watching\n\n')
  const stop = watcher.subscribe((change) => res.write(`data: ${JSON.stringify(change)}\n\n`))
  req.on('close', stop)
}

/** The editor's own static files; `/` is its `index.html`, and a path with no extension falls back to it. */
async function staticFile(res: ServerResponse, appDir: string, pathname: string): Promise<void> {
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

/** Why a request must be refused before any route sees it (a rebinding host, a page from another origin), if so. */
function refusal(
  req: IncomingMessage,
  onLoopback: boolean,
  appOrigins: readonly string[],
): string | undefined {
  const hostName = (req.headers.host ?? '').replace(/:\d+$/, '')
  if (onLoopback && !LOOPBACK_NAMES.has(hostName))
    return 'this server answers only to its own loopback address'
  const origin = req.headers.origin
  if (origin !== undefined && appOrigins.includes(origin)) return undefined
  if (
    req.method !== 'GET' &&
    req.method !== 'HEAD' &&
    origin !== undefined &&
    !sameHost(origin, req.headers.host)
  )
    return 'a page from another origin may not change files'
  return undefined
}

/** Whether `origin` (as sent, possibly `null` from a sandboxed page) is on `host`. */
function sameHost(origin: string, host: string | undefined): boolean {
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/** A preflight answer for an app origin: the methods the routes use, and the headers the editor sends. */
const PREFLIGHT_HEADERS = {
  'access-control-allow-methods': 'GET, PUT, DELETE, OPTIONS',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-max-age': '600',
} as const

/** Starts the editor's server. Listening beyond the loopback needs a token, because the editor writes files. */
export async function serveEditor(options: EditorServerOptions): Promise<RunningEditor> {
  const host = options.host ?? '127.0.0.1'
  const { token } = options
  if (!isLoopback(host) && token === undefined)
    throw new Error('listening beyond the loopback needs a token: the editor writes files')
  const appOrigins = options.appOrigins ?? []
  if (appOrigins.length > 0 && token === undefined)
    throw new Error('naming an app origin needs a token: that page can write files')
  const root = await realpath(options.root)
  const appDir = await realpath(options.appDir)
  const policy =
    options.policy ??
    editorPolicy(await readFile(join(root, 'content/editors.toml'), 'utf8').catch(() => undefined))
  const checkout = openCheckout(root, policy)
  const watcher = openWatcher(root, policy, options.watchDebounceMs ?? WATCH_DEBOUNCE_MS)
  // `gameUrl` is left out of the ping when there is none, so an older editor reads the same answer.
  const facts: PingFacts = {
    game: gameName(root),
    ...(options.gameUrl === undefined ? {} : { gameUrl: options.gameUrl }),
  }

  const server: Server = createServer((req, res) => {
    void (async () => {
      try {
        const refused = refusal(req, isLoopback(host), appOrigins)
        if (refused !== undefined) return reply(res, 403, { message: refused })
        const url = new URL(req.url ?? '/', 'http://editor')
        const origin = req.headers.origin
        if (origin !== undefined && appOrigins.includes(origin)) {
          // The answer is for that page only; a cache must not hand it to another origin.
          res.setHeader('access-control-allow-origin', origin)
          res.setHeader('vary', 'Origin')
          if (req.method === 'OPTIONS' && url.pathname.startsWith('/api/')) {
            res.writeHead(204, PREFLIGHT_HEADERS)
            return res.end()
          }
        }
        if (url.pathname.startsWith('/api/'))
          return await api(req, res, url, token, policy, checkout, facts, watcher)
        return await staticFile(res, appDir, url.pathname)
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
        watcher.close()
        server.closeAllConnections()
        server.close(() => resolveClosed())
      }),
  }
}
