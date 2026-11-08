// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { playgroundDevHeaders } from '../../../scripts/playground-dev-headers'

// `pnpm dev` serves /playground/ to an opaque-origin frame too, and Vite's default CORS does not allow Origin: null
//, so the dev server adds the same headers as the static server.
type Middleware = (
  request: { url?: string; headers?: Record<string, string> },
  response: { setHeader(name: string, value: string): void; statusCode?: number; end?(body: string): void },
  next: () => void,
) => void

function middleware(staticDir?: string): Middleware {
  let installed: Middleware | undefined
  const plugin = playgroundDevHeaders(staticDir)
  const hook = plugin.configureServer as (server: { middlewares: { use(fn: Middleware): void } }) => void
  hook({
    middlewares: {
      use: (fn) => {
        installed = fn
      },
    },
  })
  if (!installed) throw new Error('the plugin installed no middleware')
  return installed
}

function headersFor(url: string): Record<string, string> {
  const headers: Record<string, string> = {}
  let nexted = false
  middleware()(
    { url },
    {
      setHeader: (name, value) => {
        headers[name] = value
      },
    },
    () => {
      nexted = true
    },
  )
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

  it("serves a frame page with the dev server's own origin in connect-src (R-2)", () => {
    const dir = mkdtempSync(join(tmpdir(), 'playground-dev-'))
    mkdirSync(join(dir, 'playground/examples/core/basic-window'), { recursive: true })
    const page = `<meta http-equiv="Content-Security-Policy" content="connect-src 'self' https://automataframework.com" />`
    writeFileSync(join(dir, 'playground/examples/core/basic-window/index.html'), page)
    const sent: { status?: number; headers: Record<string, string>; body?: string } = { headers: {} }
    let nexted = false
    const response = {
      setHeader: (name: string, value: string) => {
        sent.headers[name] = value
      },
      set statusCode(status: number) {
        sent.status = status
      },
      end: (body: string) => {
        sent.body = body
      },
    }
    middleware(dir)(
      { url: '/playground/examples/core/basic-window/', headers: { host: 'localhost:5173' } },
      response,
      () => {
        nexted = true
      },
    )
    expect(nexted).toBe(false)
    expect(sent.body).toBe(page.replace('https://automataframework.com', 'http://localhost:5173'))
    expect(sent.headers['Content-Type']).toBe('text/html; charset=utf-8')
    expect(sent.headers['Access-Control-Allow-Origin']).toBe('*')
    rmSync(dir, { recursive: true })
  })

  it('adds nothing elsewhere', () => {
    expect(headersFor('/examples')).toEqual({})
  })
})
