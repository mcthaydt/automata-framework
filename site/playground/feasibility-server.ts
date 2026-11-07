import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { playgroundOrigin, playgroundPort } from '@mcthaydt/examples-runner/host/ports'
import { playgroundHeaders } from '../src/features/playground/headers.ts'
import { framePolicy } from './src/ruken/frame-policy.ts'
import { fileUnder, sendFile } from './static-files.ts'

// The site in miniature for the playground feasibility test: a parent page on the site's origin, the frame
// page it frames in `sandbox="allow-scripts"`, and modules under /playground/ with the frame policy's headers. /bare/ serves
// the same modules without them, to show they are needed. Every request is logged, so a test can count what a
// second frame fetched again (R-1). It serves zod's published ESM files as they are; the playground's runtime
// build replaces them.

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

interface LoggedRequest {
  readonly path: string
  readonly search: string
  readonly status: number
  readonly origin: string | null
}
const requests: LoggedRequest[] = []

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
