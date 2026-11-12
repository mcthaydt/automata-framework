// `automata editor`'s server: the editor's static build, and the game checkout's files under `/api` for
// the kit's HTTP store (`createHttpStore`, which documents the four routes; the checkout's files are `checkout.ts`). It listens on the loopback unless told to
// listen wider, and then it insists on a token; on the loopback it refuses a `Host` that is not a loopback name (DNS
// rebinding) and a cross-origin write. What a browser may read and write is the policy's (`editor-policy.ts`), and every
// path is resolved through real paths, so a symlink cannot lead out of the checkout. A guarded write is the mtime check
// the kit's stores have; the check and the write are two steps, as the kit says of its own browser stores.
import { timingSafeEqual } from 'node:crypto'
import { createReadStream, readFileSync } from 'node:fs'
import { readFile, realpath, rm, stat } from 'node:fs/promises'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { basename, extname, join, resolve, sep } from 'node:path'
import { EDITOR_LIST_PATH, listGrowsBy } from '@automata/editor/editor-list'
import { type Checkout, mtimeOf, openCheckout } from './checkout.ts'
import { type EditorPolicy, livePolicy } from './editor-policy.ts'
import type { PublishOutcome } from './publish-game.ts'

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
  /** Why the game cannot be played from here (it could not start), a sentence for the editor to show where Play would be. */
  readonly playOff?: string | undefined
  /** Builds the game and makes the zip to upload (Publish); without it the editor has no Publish for the game. */
  readonly publish?: (() => Promise<PublishOutcome>) | undefined
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

/** The editor list's text and modified time, read from the checkout each time it is asked. */
const readList = (root: string) => async (): Promise<{ text: string; mtime: number } | undefined> => {
  const path = join(root, EDITOR_LIST_PATH)
  const [text, info] = await Promise.all([readFile(path, 'utf8'), stat(path)]).catch(() => [])
  return text === undefined || info === undefined ? undefined : { text, mtime: mtimeOf(info) }
}

/** `/api/file`: read (GET), delete (DELETE) or write (PUT) one file the policy allows, inside the checkout. */
async function fileRoute(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  policyOf: () => Promise<EditorPolicy>,
  checkout: Checkout,
  root: string,
  listMayGrow: boolean,
): Promise<void> {
  const method = req.method ?? 'GET'
  const path = url.searchParams.get('path') ?? ''
  const write = method === 'PUT' || method === 'DELETE'
  const policy = await policyOf()
  // The list is never written by an editor, except to grow by an editor's own rows (`listGrowsBy`): then the editors
  // can add themselves to a game and can never widen what they may touch. A game with no list gets none.
  const growing = listMayGrow && method === 'PUT' && path === EDITOR_LIST_PATH
  if (!growing && !(write ? policy.canWrite(path) : policy.canRead(path)))
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
  if (growing) {
    const current = await readFile(join(root, EDITOR_LIST_PATH), 'utf8').catch(() => undefined)
    if (current === undefined || !listGrowsBy(current, body.toString('utf8')))
      return reply(res, 403, { message: "The editors can only add to this game's list of editors." })
  }
  const outcome = await checkout.write(full, path, body, url.searchParams.get('expected'))
  if ('conflict' in outcome) return reply(res, 409, { message: outcome.conflict })
  return reply(res, 200, { mtime: outcome.mtime })
}

/**
 * What Home calls the game: the `automata.title` its package.json gives ("Ember Hall"), else its folder's name in
 * words ("emberwick" is "Emberwick", "my-cool-game" is "My cool game"). The folder is the one name every game has
 * whatever its targets; a title lives in a target's own config.
 */
export function gameName(root: string): string {
  const title = packageTitle(root)
  if (title !== undefined) return title
  const words = basename(root).replace(/[-_]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** The `automata.title` of the game's package.json; undefined when the file, the field or valid JSON is missing. */
function packageTitle(root: string): string | undefined {
  try {
    const title = (
      JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { automata?: { title?: unknown } }
    ).automata?.title
    return typeof title === 'string' && title.trim() !== '' ? title.trim() : undefined
  } catch {
    return undefined
  }
}

/** What the ping tells the editor: the game's name and, when there are, its dev page (or why there is none) and whether it can publish. */
interface PingFacts {
  readonly game: string
  readonly gameUrl?: string | undefined
  readonly playOff?: string | undefined
  readonly publish?: true
}

/**
 * `/api/publish`: a POST runs Publish, one at a time, and answers what came of it; a GET of `/api/publish/file` hands
 * over the zip the last good Publish made, as a download. Only that file: the route takes no path.
 */
function publishRoute(
  publish: () => Promise<PublishOutcome>,
): (req: IncomingMessage, res: ServerResponse, url: URL) => Promise<void> {
  let running = false
  let made: string | undefined
  return async (req, res, url) => {
    if (url.pathname === '/api/publish/file' && req.method === 'GET') {
      const info = made === undefined ? undefined : await stat(made).catch(() => undefined)
      if (made === undefined || info === undefined || !info.isFile())
        return reply(res, 404, {
          message: 'Nothing has been built yet. Open Publish and press Build my game.',
        })
      res.writeHead(200, {
        'content-type': 'application/zip',
        'content-disposition': `attachment; filename="${basename(made)}"`,
        'content-length': String(info.size),
        'cache-control': 'no-store',
      })
      createReadStream(made).pipe(res)
      return
    }
    if (url.pathname !== '/api/publish' || req.method !== 'POST')
      return reply(res, 404, { message: 'no such route' })
    if (running)
      return reply(res, 409, { message: 'Your game is already being built. Wait for it to finish.' })
    running = true
    try {
      const outcome = await publish()
      made = outcome.ok ? outcome.file : undefined
      return reply(res, 200, outcome.ok ? { ok: true, name: basename(outcome.file) } : outcome)
    } finally {
      running = false
    }
  }
}

/** The `/api` routes: ping (with the game's name), list, file and publish; a token is checked first when the server has one. */
async function api(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  token: string | undefined,
  policyOf: () => Promise<EditorPolicy>,
  checkout: Checkout,
  root: string,
  listMayGrow: boolean,
  facts: PingFacts,
  publish: ((req: IncomingMessage, res: ServerResponse, url: URL) => Promise<void>) | undefined,
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
  if (url.pathname.startsWith('/api/publish') && publish !== undefined) return publish(req, res, url)
  if (url.pathname !== '/api/file') return reply(res, 404, { message: 'no such route' })
  return fileRoute(req, res, url, policyOf, checkout, root, listMayGrow)
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
function refusal(req: IncomingMessage, onLoopback: boolean): string | undefined {
  const hostName = (req.headers.host ?? '').replace(/:\d+$/, '')
  if (onLoopback && !LOOPBACK_NAMES.has(hostName))
    return 'this server answers only to its own loopback address'
  const origin = req.headers.origin
  if (
    req.method !== 'GET' &&
    req.method !== 'HEAD' &&
    origin !== undefined &&
    new URL(origin).host !== req.headers.host
  )
    return 'a page from another origin may not change files'
  return undefined
}

/** Starts the editor's server. Listening beyond the loopback needs a token, because the editor writes files. */
export async function serveEditor(options: EditorServerOptions): Promise<RunningEditor> {
  const host = options.host ?? '127.0.0.1'
  const { token } = options
  if (!isLoopback(host) && token === undefined)
    throw new Error('listening beyond the loopback needs a token: the editor writes files')
  const root = await realpath(options.root)
  const appDir = await realpath(options.appDir)
  // An explicit policy (tests) stays fixed; otherwise the editor list is read again when it changes on disk.
  const given = options.policy
  const policyOf = given === undefined ? livePolicy(readList(root)) : async () => given
  const checkout = openCheckout(root, policyOf)
  // `gameUrl` is left out of the ping when there is none, so an older editor reads the same answer.
  const facts: PingFacts = {
    game: gameName(root),
    ...(options.gameUrl === undefined ? {} : { gameUrl: options.gameUrl }),
    ...(options.gameUrl === undefined && options.playOff !== undefined ? { playOff: options.playOff } : {}),
    ...(options.publish === undefined ? {} : { publish: true }),
  }
  const publish = options.publish === undefined ? undefined : publishRoute(options.publish)

  const server: Server = createServer((req, res) => {
    void (async () => {
      try {
        const refused = refusal(req, isLoopback(host))
        if (refused !== undefined) return reply(res, 403, { message: refused })
        const url = new URL(req.url ?? '/', 'http://editor')
        if (url.pathname.startsWith('/api/'))
          return await api(
            req,
            res,
            url,
            token,
            policyOf,
            checkout,
            root,
            given === undefined,
            facts,
            publish,
          )
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
        server.closeAllConnections()
        server.close(() => resolveClosed())
      }),
  }
}
