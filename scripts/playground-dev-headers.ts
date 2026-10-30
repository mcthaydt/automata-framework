import type { Plugin } from 'vite'
import { playgroundHeaders } from '../src/lib/playground/headers'

/**
 * The dev server's /playground/ CORS and CORP headers (spec §11.3), the rule the static server and the production host
 * use. Its Cache-Control is advisory here: Vite's static middleware sets its own afterwards, which is right for a
 * server whose files change under it; the static server is where the cache rule is tested.
 */
export function playgroundDevHeaders(): Plugin {
  return {
    name: 'automata-playground-headers',
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = new URL(request.url ?? '/', 'http://localhost').pathname
        for (const [name, value] of Object.entries(playgroundHeaders(pathname))) response.setHeader(name, value)
        next()
      })
    },
  }
}
