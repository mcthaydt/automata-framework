// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { playgroundDevHeaders } from '../scripts/playground-dev-headers'

// `pnpm dev` serves /playground/ to an opaque-origin frame too, and Vite's default CORS does not allow Origin: null
// (spec §11.3), so the dev server adds the same headers as the static server.
type Middleware = (request: { url?: string }, response: { setHeader(name: string, value: string): void }, next: () => void) => void

function middleware(): Middleware {
  let installed: Middleware | undefined
  const plugin = playgroundDevHeaders()
  const hook = plugin.configureServer as (server: { middlewares: { use(fn: Middleware): void } }) => void
  hook({ middlewares: { use: fn => { installed = fn } } })
  if (!installed) throw new Error('the plugin installed no middleware')
  return installed
}

function headersFor(url: string): Record<string, string> {
  const headers: Record<string, string> = {}
  let nexted = false
  middleware()({ url }, { setHeader: (name, value) => { headers[name] = value } }, () => { nexted = true })
  expect(nexted).toBe(true)
  return headers
}

describe('playgroundDevHeaders', () => {
  it('adds the playground headers under /playground/, query strings included, and passes the request on', () => {
    expect(headersFor('/playground/runtime/automata-1a2b.js?v=1')).toEqual({
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin',
      'Cache-Control': 'public, max-age=31536000, immutable',
    })
  })

  it('adds nothing elsewhere', () => {
    expect(headersFor('/examples')).toEqual({})
  })
})
