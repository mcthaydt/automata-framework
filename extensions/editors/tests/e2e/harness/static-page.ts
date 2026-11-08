// The editors' page as the site serves it with no editor server behind it: the built suite page from a folder, and every
// `/api/` answered "not found", so the page opens the game it keeps in the browser. A journey opens it in a persistent
// browser context, because that is the one that keeps files between a close and an open (Playwright's default context is
// a private window).
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import { extname, join, normalize } from 'node:path'
import { SUITE_PAGE } from './run-editor.ts'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
}

export interface StaticPage {
  readonly url: string
  readonly stop: () => Promise<void>
}

export function serveSuitePage(): Promise<StaticPage> {
  const server: Server = createServer((request, response) => {
    const path = decodeURIComponent((request.url ?? '/').split('?')[0] ?? '/')
    if (path.startsWith('/api/')) {
      response.writeHead(404).end('not an editor server')
      return
    }
    const file = normalize(join(SUITE_PAGE, path === '/' ? 'index.html' : path))
    if (!file.startsWith(SUITE_PAGE) || !existsSync(file) || !statSync(file).isFile()) {
      response.writeHead(404).end()
      return
    }
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' })
    createReadStream(file).pipe(response)
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      const port = typeof address === 'object' && address !== null ? address.port : 0
      resolve({
        url: `http://127.0.0.1:${String(port)}/`,
        stop: () => new Promise((done) => server.close(() => done())),
      })
    })
  })
}
