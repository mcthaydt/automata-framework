import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { playgroundFrameOrigin, playgroundFramePort } from '@mcthaydt/examples-runner/host/ports'
import { type CatalogEntry, readCatalog } from '@mcthaydt/examples-runner/catalog'
import { playgroundFramePage } from './src/frame-page.ts'
import { playgroundHeaders } from '../src/lib/playground/headers.ts'
import { runtimeFromViteManifest } from './src/vite-runtime.ts'
import { fileUnder, sendFile } from './static-files.ts'

// The playground frame's test server: the runtime build (playground/vite.config.ts), a frame page per
// catalog example, each example's public files, the shared resources and the goldens, all under /playground/ with
// the frame policy's headers, as the site will publish them. `/` is a test parent page whose
// script (static/frame-parent.js) frames an example and speaks the protocol. The playground build turns the same pieces into
// the build the site syncs.

const here = fileURLToPath(new URL('.', import.meta.url))
const examples = fileURLToPath(new URL('../../examples/2d/', import.meta.url))
const RUNTIME = join(here, 'dist', 'runtime')
const runtime = runtimeFromViteManifest(
  JSON.parse(readFileSync(join(RUNTIME, '.vite', 'manifest.json'), 'utf8')) as Parameters<
    typeof runtimeFromViteManifest
  >[0],
  '/playground/runtime/',
)
const catalog = new Map<string, CatalogEntry>(
  readCatalog(examples).map((entry) => [`${entry.module}/${entry.name}`, entry]),
)

const PARENT_PAGE = `<!doctype html>
<html lang="en">
  <head><meta charset="utf-8" /><title>Playground frame test parent</title></head>
  <body><script src="/static/frame-parent.js"></script></body>
</html>
`

function framePage(entry: CatalogEntry): string {
  return playgroundFramePage(
    {
      id: entry.id,
      title: entry.header?.title ?? entry.id,
      path: entry.path,
      host: entry.header?.host,
      pending: entry.header?.pending,
    },
    runtime,
    playgroundFrameOrigin,
  )
}

const server = createServer((request, response) => {
  const path = new URL(request.url ?? '/', 'http://localhost').pathname
  const headers = playgroundHeaders(path)
  if (path === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html' }).end(PARENT_PAGE)
    return
  }
  if (path === '/static/frame-parent.js')
    return sendFile(response, join(here, 'static', 'frame-parent.js'), {})
  if (path.startsWith('/playground/runtime/'))
    return sendFile(response, fileUnder(RUNTIME, path.slice('/playground/runtime/'.length)), headers)
  if (path.startsWith('/playground/goldens/'))
    return sendFile(
      response,
      fileUnder(join(examples, '__goldens__'), path.slice('/playground/goldens/'.length)),
      headers,
    )
  if (path.startsWith('/playground/examples/resources/'))
    return sendFile(
      response,
      fileUnder(join(examples, 'resources'), path.slice('/playground/examples/resources/'.length)),
      headers,
    )
  const page = /^\/playground\/examples\/([a-z0-9]+)\/([a-z0-9-]+)\/(.*)$/.exec(path)
  const entry = page === null ? undefined : catalog.get(`${page[1]}/${page[2]}`)
  if (page !== null && entry !== undefined) {
    if (page[3] === '') {
      response.writeHead(200, { 'Content-Type': 'text/html', ...headers }).end(framePage(entry))
      return
    }
    return sendFile(
      response,
      fileUnder(join(examples, 'public', entry.module, entry.name), page[3] ?? ''),
      headers,
    )
  }
  response.writeHead(404).end()
})
server.listen(Number(process.env.AF_E2E_PLAYGROUND_FRAME_PORT ?? playgroundFramePort), '127.0.0.1')
