import { readdirSync, readFileSync, statSync } from 'node:fs'
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { extname, join } from 'node:path'
import { embedPage } from './embed-page.ts'

/*
 * An itch.io-like place to run a game build in tests (PUB spec §7). itch.io serves every HTML5 game from its
 * own origin (html.itch.zone), under a per-upload subdirectory, in an iframe on the game's page (itch.io).
 * The harness does the same with two local origins: the embed page on 127.0.0.1 and the builds on localhost,
 * each under /html/<name>/. File names are matched case-sensitively, as itch.io's are, whatever the disk does.
 */

export interface ItchHarnessOptions {
  /** Each game's name (its subdirectory) and the build folder served there. */
  readonly games: Readonly<Record<string, string>>
  /** 0 picks a free port. */
  readonly pagePort: number
  readonly gamePort: number
}

export interface ItchHarness {
  /** The embed page: `${pageOrigin}/?game=<name>`, plus `&storage=blocked` to deny the frame storage. */
  readonly pageOrigin: string
  readonly gameOrigin: string
  close(): Promise<void>
}

const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.map': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.txt': 'text/plain; charset=utf-8',
}

function notFound(response: ServerResponse): void {
  response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found')
}

/**
 * The file `segments` names inside `root`, or null. Each segment must be an exact, case-sensitive entry of its
 * folder, so `..`, `.` and a wrong-case name never resolve; a folder (or an empty last segment) means its index.html.
 */
function resolveExact(root: string, segments: readonly string[]): string | null {
  let path = root
  for (const segment of segments) {
    if (segment === '') continue
    if (!statSync(path).isDirectory() || !readdirSync(path).includes(segment)) return null
    path = join(path, segment)
  }
  if (statSync(path).isDirectory()) {
    if (!readdirSync(path).includes('index.html')) return null
    path = join(path, 'index.html')
  }
  return path
}

function serveGame(games: ItchHarnessOptions['games']) {
  return (request: IncomingMessage, response: ServerResponse) => {
    let segments: string[]
    try {
      segments = new URL(request.url ?? '/', 'http://harness').pathname.split('/').map(decodeURIComponent)
    } catch {
      return notFound(response)
    }
    // ['', 'html', '<name>', ...file]
    const [, html, name, ...file] = segments
    const root = name === undefined ? undefined : games[name]
    if (html !== 'html' || root === undefined || file.length === 0) return notFound(response)
    const path = resolveExact(root, file)
    if (path === null) return notFound(response)
    response.writeHead(200, {
      'content-type': CONTENT_TYPES[extname(path)] ?? 'application/octet-stream',
      // A frame denied storage (sandboxed, opaque origin) loads its module scripts in CORS mode.
      'access-control-allow-origin': '*',
      'cache-control': 'no-store',
    })
    response.end(readFileSync(path))
  }
}

function servePage(games: ItchHarnessOptions['games'], gameOrigin: () => string) {
  return (request: IncomingMessage, response: ServerResponse) => {
    const url = new URL(request.url ?? '/', 'http://harness')
    const name = url.searchParams.get('game') ?? ''
    if (url.pathname !== '/' || games[name] === undefined) return notFound(response)
    const gameUrl = `${gameOrigin()}/html/${encodeURIComponent(name)}/index.html`
    const blockStorage = url.searchParams.get('storage') === 'blocked'
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
    response.end(embedPage({ gameUrl, blockStorage }))
  }
}

function listen(server: Server, port: number, host: string): Promise<number> {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => resolve((server.address() as AddressInfo).port))
  })
}

function closeServer(server: Server): Promise<void> {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())))
}

/** Starts the game origin (localhost) and the embed page (127.0.0.1). */
export async function startItchHarness(options: ItchHarnessOptions): Promise<ItchHarness> {
  let gameOrigin = ''
  const gameServer = createServer(serveGame(options.games))
  const pageServer = createServer(servePage(options.games, () => gameOrigin))
  gameOrigin = `http://localhost:${await listen(gameServer, options.gamePort, 'localhost')}`
  const pageOrigin = `http://127.0.0.1:${await listen(pageServer, options.pagePort, '127.0.0.1')}`
  return {
    pageOrigin,
    gameOrigin,
    close: async () => {
      await Promise.all([closeServer(gameServer), closeServer(pageServer)])
    },
  }
}
