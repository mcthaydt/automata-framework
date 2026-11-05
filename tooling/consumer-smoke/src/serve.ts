// A static file server for the game build the smoke boots: the build folder on a free loopback port, with
// the headers Ruken would serve the game with, so the boot runs under Ruken's CSP. Plain `node:http`: the smoke
// project has Vite, but its preview server cannot be told to stop from here without owning its process.
import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, sep } from 'node:path'

export interface StaticServer {
  /** `http://127.0.0.1:<port>`, no trailing slash. */
  readonly url: string
  close(): Promise<void>
}

/** The types a browser checks: a module script must be JavaScript, and a strict CSP build must not sniff. */
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.wasm': 'application/wasm',
}

/**
 * The file below `root` that `url` names (`/` is `index.html`), undefined when it would leave `root`, or null when
 * its path is not a valid percent-encoding (`decodeURIComponent` throws `URIError`, e.g. `/%E0%A4%A`).
 */
function fileFor(root: string, url: string): string | undefined | null {
  let path: string
  try {
    path = decodeURIComponent(new URL(url, 'http://local').pathname)
  } catch {
    return null
  }
  const relative = normalize(path.endsWith('/') ? `${path}index.html` : path).replace(/^[/\\]+/, '')
  if (relative.split(sep).includes('..')) return undefined
  return join(root, relative)
}

/** Serves `root` on 127.0.0.1 at a free port until `close`; every response carries `headers`. */
export function serveStatic(root: string, headers: Readonly<Record<string, string>>): Promise<StaticServer> {
  const server = createServer((request, response) => {
    const file = fileFor(root, request.url ?? '/')
    if (file === null) {
      response.writeHead(400, headers)
      response.end()
      return
    }
    const answer = async (): Promise<void> => {
      if (file === undefined) throw new Error('outside the build')
      const body = await readFile(file)
      response.writeHead(200, {
        ...headers,
        'Content-Type': CONTENT_TYPES[extname(file)] ?? 'application/octet-stream',
      })
      response.end(body)
    }
    answer().catch(() => {
      response.writeHead(404, headers)
      response.end()
    })
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      if (address === null || typeof address === 'string') {
        reject(new Error('the server has no port'))
        return
      }
      resolve({
        url: `http://127.0.0.1:${address.port}`,
        close: () =>
          new Promise<void>((done) => {
            server.closeAllConnections()
            server.close(() => done())
          }),
      })
    })
  })
}
