import type { Plugin } from 'vite'
import { playgroundHeaders } from '../src/lib/playground/headers'

/** The dev server's /playground/ headers (spec §11.3), the same rule the static server and the production host use. */
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
