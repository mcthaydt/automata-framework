// A static server for a built folder, on a free port: what the site's "Try the editor" is, a page with no game behind
// it, so the editor keeps its levels in the browser and Share is how a level leaves. Journeys use it for the built 2D
// editor (`packages/editor/dist/2d`, from `pnpm build`).
import { readFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { extname, join, normalize } from 'node:path'

const TYPES: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}

export interface ServedFolder {
  readonly url: string
  readonly stop: () => Promise<void>
}

export interface ServeOptions {
  /** The address the folder answers under, like the site's `/editor/app/` (default: the root). */
  readonly prefix?: string
  /** Added to every answer (the site's Content-Security-Policy). */
  readonly headers?: Readonly<Record<string, string>>
}

export async function serveFolder(root: string, options: ServeOptions = {}): Promise<ServedFolder> {
  const prefix = options.prefix ?? '/'
  const server: Server = createServer((request, response) => {
    const asked = decodeURIComponent((request.url ?? '/').split('?')[0] ?? '/')
    if (!asked.startsWith(prefix)) {
      response.writeHead(404).end()
      return
    }
    const path = `/${asked.slice(prefix.length)}`
    // Nothing outside the folder: a path that climbs out of it is a 404, like any other missing file.
    const file = normalize(join(root, path.endsWith('/') ? `${path}index.html` : path))
    if (!file.startsWith(root)) {
      response.writeHead(404).end()
      return
    }
    readFile(file).then(
      (bytes) => {
        response
          .writeHead(200, {
            'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
            ...options.headers,
          })
          .end(bytes)
      },
      () => {
        response.writeHead(404).end()
      },
    )
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}${prefix}`,
    stop: () => new Promise((resolve) => server.close(() => resolve())),
  }
}
