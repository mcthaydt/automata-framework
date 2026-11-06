import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Plugin } from 'vite'
import { playgroundHeaders } from '../src/lib/playground/headers.ts'
import { framePageForOrigin, isFramePage } from './playground-origin.ts'

/**
 * The dev server's /playground/ CORS and CORP headers (spec §11.3), the rule the static server and the production host
 * use. Its Cache-Control is advisory here: Vite's static middleware sets its own afterwards, which is right for a
 * server whose files change under it; the static server is where the cache rule is tested. A frame page is answered
 * here, naming the dev server's own origin in its connect-src (R-2).
 */
export function playgroundDevHeaders(staticDir = 'static'): Plugin {
  return {
    name: 'automata-playground-headers',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
        for (const [name, value] of Object.entries(playgroundHeaders(pathname)))
          response.setHeader(name, value)
        const file = join(staticDir, pathname.endsWith('/') ? `${pathname}index.html` : pathname)
        if (isFramePage(pathname) && request.headers?.host && existsSync(file)) {
          response.setHeader('Content-Type', 'text/html; charset=utf-8')
          response.statusCode = 200
          response.end(framePageForOrigin(readFileSync(file, 'utf8'), `http://${request.headers.host}`))
          return
        }
        next()
      })
    },
  }
}
