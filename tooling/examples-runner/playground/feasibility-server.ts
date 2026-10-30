import { readFileSync } from 'node:fs'
import { createServer, type ServerResponse } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, extname, isAbsolute, join, normalize, relative } from 'node:path'
import { playgroundOrigin, playgroundPort } from '../host/ports.ts'
import { framePolicy } from '../src/playground/frame-policy.ts'
import { playgroundHeaders } from '../src/playground/playground-headers.ts'

// The site in miniature for WEB.PLAY.1 (website playground spec §17): a parent page on the site's origin, the frame
// page it frames in `sandbox="allow-scripts"`, and modules under /playground/ with the §11.3 headers. /bare/ serves
// the same modules without them, to show they are needed. Every request is logged, so a test can count what a
// second frame fetched again (R-1). It serves zod's published ESM files as they are; WEB.PLAY.3's runtime build
// replaces them.

const STATIC = join(import.meta.dirname, 'static')
const ZOD = dirname(createRequire(import.meta.url).resolve('zod/package.json'))

/** The frame page's one inline script; the policy carries its hash. */
export const IMPORT_MAP = JSON.stringify({ imports: { zod: '/playground/runtime/zod/index.js' } })

const PARENT_PAGE = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Playground feasibility</title></head>
  <body><script src="/static/parent.js"></script></body>
</html>
`

const FRAME_PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="Content-Security-Policy" content="${framePolicy(IMPORT_MAP, playgroundOrigin)}" />
    <title>Playground feasibility frame</title>
    <script type="importmap">${IMPORT_MAP}</script>
  </head>
  <body>
    <script type="module" src="/playground/runtime/frame.js"></script>
  </body>
</html>
`

const TYPES: Record<string, string> = {
  '.js': 'text/javascript',
  '.html': 'text/html',
  '.txt': 'text/plain',
  '.svg': 'image/svg+xml',
}

interface LoggedRequest {
  readonly path: string
  readonly search: string
  readonly status: number
  readonly origin: string | null
}
const requests: LoggedRequest[] = []

/** The file under `root` that `relative` names, or undefined when it climbs out of it. */
function fileUnder(root: string, relativePath: string): string | undefined {
  const file = normalize(join(root, relativePath))
  const inside = relative(root, file)
  return inside === '' || inside.startsWith('..') || isAbsolute(inside) ? undefined : file
}

function sendFile(response: ServerResponse, file: string | undefined, headers: Record<string, string>): void {
  let body: Buffer
  try {
    if (file === undefined) throw new Error('outside the root')
    body = readFileSync(file)
  } catch {
    response.writeHead(404).end()
    return
  }
  response
    .writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream', ...headers })
    .end(body)
}

/** Where a module path under /playground/runtime/ or /bare/ lives: zod's package, or this proof's scripts. */
function moduleFile(rest: string): string | undefined {
  return rest.startsWith('zod/') ? fileUnder(ZOD, rest.slice('zod/'.length)) : fileUnder(STATIC, rest)
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? '/', 'http://localhost')
  const path = url.pathname
  if (path === '/requests') {
    response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify(requests))
    return
  }
  response.on('finish', () =>
    requests.push({
      path,
      search: url.search,
      status: response.statusCode,
      origin: request.headers.origin ?? null,
    }),
  )
  if (path === '/') response.writeHead(200, { 'Content-Type': 'text/html' }).end(PARENT_PAGE)
  else if (path === '/playground/frame/')
    response.writeHead(200, { 'Content-Type': 'text/html', ...playgroundHeaders(path) }).end(FRAME_PAGE)
  else if (path === '/static/parent.js') sendFile(response, join(STATIC, 'parent.js'), {})
  else if (path.startsWith('/playground/runtime/'))
    sendFile(response, moduleFile(path.slice('/playground/runtime/'.length)), playgroundHeaders(path))
  else if (path.startsWith('/bare/')) sendFile(response, moduleFile(path.slice('/bare/'.length)), {})
  else response.writeHead(404).end()
})
server.listen(Number(process.env.AF_E2E_PLAYGROUND_PORT ?? playgroundPort), '127.0.0.1')
