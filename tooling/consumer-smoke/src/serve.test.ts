import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { type StaticServer, serveStatic } from './serve.ts'

function buildWith(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'af-smoke-serve-'))
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true })
    writeFileSync(join(dir, path), text)
  }
  return dir
}

let server: StaticServer | undefined
afterEach(async () => {
  await server?.close()
  server = undefined
})

describe('serveStatic (the game build the smoke boots, DX.2a)', () => {
  it('serves the entry document at / with the given headers', async () => {
    server = await serveStatic(buildWith({ 'index.html': '<main id="game"></main>' }), {
      'Content-Security-Policy': "script-src 'self'",
    })
    const response = await fetch(`${server.url}/`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(response.headers.get('content-security-policy')).toBe("script-src 'self'")
    expect(await response.text()).toBe('<main id="game"></main>')
  })

  it('serves module scripts and styles with the types a browser checks', async () => {
    server = await serveStatic(buildWith({ 'assets/index.js': 'export {}', 'assets/index.css': 'p{}' }), {})
    expect((await fetch(`${server.url}/assets/index.js`)).headers.get('content-type')).toBe(
      'text/javascript; charset=utf-8',
    )
    expect((await fetch(`${server.url}/assets/index.css`)).headers.get('content-type')).toBe(
      'text/css; charset=utf-8',
    )
  })

  it('answers 404 for a missing file and for a path outside the build', async () => {
    const dir = buildWith({ 'index.html': '' })
    writeFileSync(join(dir, '..', 'af-smoke-outside.txt'), 'secret')
    server = await serveStatic(dir, {})
    expect((await fetch(`${server.url}/missing.js`)).status).toBe(404)
    expect((await fetch(`${server.url}/%2e%2e/af-smoke-outside.txt`)).status).toBe(404)
  })

  it('listens on a free loopback port of its own', async () => {
    server = await serveStatic(buildWith({ 'index.html': '' }), {})
    expect(server.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/)
  })
})
