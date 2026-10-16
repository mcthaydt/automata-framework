// Serves a static directory the way the production static host will: `/docs/faq` → `docs/faq.html`,
// `/x/` → `x/index.html`, and anything else → `404.html` with status 404. The Playwright suite runs against it so the
// browser checks see the prerendered build, not a dev server.
//   node --import tsx scripts/serve-static.ts <directory> <port>
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { extname, join, resolve, sep } from 'node:path'

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml', '.svg': 'image/svg+xml',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2',
  '.wasm': 'application/wasm', '.toml': 'text/plain; charset=utf-8',
}

const root = resolve(process.argv[2] ?? 'build')
const port = Number(process.argv[3] ?? 4650)

function isFile(path: string): boolean {
  return existsSync(path) && statSync(path).isFile()
}

/** Maps a URL path to a file inside root, or undefined. Never resolves outside root. */
function fileFor(pathname: string): string | undefined {
  const decoded = decodeURIComponent(pathname)
  const base = resolve(root, '.' + decoded)
  if (base !== root && !base.startsWith(root + sep)) return undefined
  const candidates = decoded.endsWith('/') ? [join(base, 'index.html')] : [base, base + '.html', join(base, 'index.html')]
  return candidates.find(isFile)
}

createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost')
  const file = fileFor(url.pathname)
  const notFound = join(root, '404.html')
  const [status, path] = file ? [200, file] : isFile(notFound) ? [404, notFound] : [404, undefined]
  if (!path) { response.writeHead(404, { 'content-type': 'text/plain' }).end('Not found'); return }
  response.writeHead(status, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' })
  if (request.method === 'HEAD') { response.end(); return }
  createReadStream(path).pipe(response)
}).listen(port, '127.0.0.1', () => console.log(`Serving ${root} at http://127.0.0.1:${port}/`))
