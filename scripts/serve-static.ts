// Serves a static directory the way the production static host will: `/docs/faq` → `docs/faq.html`,
// `/x/` → `x/index.html`, and anything else → `404.html` with status 404. The Playwright suite runs against it so the
// browser checks see the prerendered build, not a dev server.
//   node --import tsx scripts/serve-static.ts <directory> <port> [--compressed]
// `--compressed` is what the Lighthouse budget runs on: it answers with the `.br` or `.gz` sibling that adapter-static
// wrote next to each file when the request accepts it, as the production host will, so transfer sizes are real.
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
const compressed = process.argv.includes('--compressed')
const ENCODINGS = [['br', '.br'], ['gzip', '.gz']] as const

/** Whether the Accept-Encoding header lists `encoding` with a quality above zero. */
function accepts(acceptEncoding: string | undefined, encoding: string): boolean {
  for (const part of (acceptEncoding ?? '').split(',')) {
    const [name, ...params] = part.trim().split(';')
    if (name === encoding) return !params.some(param => /^\s*q=0(\.0+)?\s*$/.test(param))
  }
  return false
}

/** The precompressed sibling of `file` the request accepts (brotli first), or undefined. */
function encodedSibling(file: string, acceptEncoding: string | undefined): { encoding: string; path: string } | undefined {
  for (const [encoding, extension] of ENCODINGS) {
    if (accepts(acceptEncoding, encoding) && isFile(file + extension)) return { encoding, path: file + extension }
  }
  return undefined
}

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
  const headers: Record<string, string> = { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream', 'cache-control': 'no-store' }
  const sibling = compressed ? encodedSibling(path, request.headers['accept-encoding']) : undefined
  if (compressed) headers.vary = 'Accept-Encoding'
  if (sibling) headers['content-encoding'] = sibling.encoding
  response.writeHead(status, headers)
  if (request.method === 'HEAD') { response.end(); return }
  createReadStream(sibling?.path ?? path).pipe(response)
}).listen(port, '127.0.0.1', () => console.log(`Serving ${root} at http://127.0.0.1:${port}/`))
