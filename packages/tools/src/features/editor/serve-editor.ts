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
import { EDITOR_LIST_PATH, fileAccess, loadEditorList } from '@automata/editor/editor-list'
import { type ArgvChecksOptions, createArgvChecks } from '@automata/editor/suite/node'
import { type Checkout, openCheckout } from './checkout.ts'
import { type EditorPolicy, editorPolicy } from './editor-policy.ts'
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

/** What the ping tells the editor: the game's name and, when there are, its dev page and whether it can publish. */
interface PingFacts {
  readonly game: string
  readonly gameUrl?: string | undefined
  readonly publish?: true
  readonly checks?: true
}

/** The game's own checks, run for the page: the `[[check]]` rows of the checkout's editor list, and nothing else. */
type ChecksRunner = ReturnType<typeof createArgvChecks>

/**
 * `/api/checks/run`: a POST of `{ checks, candidates }` runs the declared checks as argv in the checkout (no shell) and
 * answers `{ results }`. The commands are the game owner's, written in `content/editors.toml`, which no browser can write
 * (`ALWAYS_NEVER`); the page names a check by id and supplies only the text of the files to try, which are written to a
 * folder of their own. An id the list does not declare comes back as an error result, never as a command.
 */
function checksRoute(runner: ChecksRunner): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    if (req.method !== 'POST') return reply(res, 405, { message: 'method not allowed' })
    const body = await readBody(req)
    if (body === undefined) return reply(res, 413, { message: 'the request is over 16 MB' })
    const asked = asRequest(body.toString('utf8'))
    if (asked === undefined) return reply(res, 400, { message: 'that is not a request to run checks' })
    const run = await runner.run(asked)
    return reply(res, 200, { results: await run.result() })
  }
}

/** A body of `{ checks: string[], candidates?: { path, text }[] }`, or nothing. */
function asRequest(text: string): Parameters<ChecksRunner['run']>[0] | undefined {
  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return undefined
  }
  if (typeof json !== 'object' || json === null) return undefined
  const { checks, candidates = [] } = json as { checks?: unknown; candidates?: unknown }
  const strings = Array.isArray(checks) && checks.every((id) => typeof id === 'string')
  const files =
    Array.isArray(candidates) &&
    candidates.every(
      (each) =>
        typeof each === 'object' &&
        each !== null &&
        typeof (each as { path?: unknown }).path === 'string' &&
        typeof (each as { text?: unknown }).text === 'string',
    )
  return strings && files ? { checks, candidates: candidates as { path: string; text: string }[] } : undefined
}

/** The runner for a checkout's editor list, or none when the list declares no check. */
function checksOf(root: string, listText: string | undefined): ChecksRunner | undefined {
  const loaded = listText === undefined ? undefined : loadEditorList(listText)
  if (loaded === undefined || !loaded.ok || loaded.list.check.length === 0) return undefined
  const { list } = loaded
  const sceneOf: NonNullable<ArgvChecksOptions['sceneOf']> = (path) => {
    const access = fileAccess(list, path)
    return access.writable ? access.scene : undefined
  }
  return createArgvChecks({ root, checks: list.check, sceneOf })
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
        return reply(res, 404, { message: 'nothing published yet: press Publish first' })
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
    if (running) return reply(res, 409, { message: 'your game is already being published' })
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

/** The `/api` routes: ping (with the game's name), list, file, publish and checks; a token is checked first when the server has one. */
async function api(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
  token: string | undefined,
  policy: EditorPolicy,
  checkout: Checkout,
  facts: PingFacts,
  publish: ((req: IncomingMessage, res: ServerResponse, url: URL) => Promise<void>) | undefined,
  checks: ((req: IncomingMessage, res: ServerResponse) => Promise<void>) | undefined,
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
  if (url.pathname === '/api/checks/run' && checks !== undefined) return checks(req, res)
  if (url.pathname !== '/api/file') return reply(res, 404, { message: 'no such route' })
  return fileRoute(req, res, url, policy, checkout)
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
  const listText = await readFile(join(root, EDITOR_LIST_PATH), 'utf8').catch(() => undefined)
  const policy = options.policy ?? editorPolicy(listText)
  const runner = checksOf(root, listText)
  const checkout = openCheckout(root, policy)
  // `gameUrl` is left out of the ping when there is none, so an older editor reads the same answer.
  const facts: PingFacts = {
    game: gameName(root),
    ...(options.gameUrl === undefined ? {} : { gameUrl: options.gameUrl }),
    ...(options.publish === undefined ? {} : { publish: true }),
    ...(runner === undefined ? {} : { checks: true }),
  }
  const publish = options.publish === undefined ? undefined : publishRoute(options.publish)
  const checks = runner === undefined ? undefined : checksRoute(runner)

  const server: Server = createServer((req, res) => {
    void (async () => {
      try {
        const refused = refusal(req, isLoopback(host))
        if (refused !== undefined) return reply(res, 403, { message: refused })
        const url = new URL(req.url ?? '/', 'http://editor')
        if (url.pathname.startsWith('/api/'))
          return await api(req, res, url, token, policy, checkout, facts, publish, checks)
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
