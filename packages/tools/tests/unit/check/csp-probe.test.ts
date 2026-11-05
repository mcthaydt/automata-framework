import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Effect } from 'effect'
import { afterAll, describe, expect, it } from 'vitest'
import { headersFor, serveDist } from '#src/features/check/ruken/csp-probe-live.ts'
import { defineShipConfig } from '../../../src/features/ship/config/ship-config.ts'

const config = defineShipConfig({
  game: { id: 'check-fixture', title: 'Check Fixture', version: '0.1.0', entry: 'index.html', sdk: '^0.0.0' },
  runtime: { renderer: 'webgl2', orientation: 'any', inputs: ['keyboard'], pause_behavior: 'pause' },
  network: { connect: [] },
  content: { languages: ['en'], rating: 'everyone', descriptors: [] },
})

describe('headersFor', () => {
  it('compiles Ruken’s headers for the game’s manifest: scripts from self, no unsafe-eval', async () => {
    const headers = await Effect.runPromise(headersFor(config))
    const csp = headers['Content-Security-Policy'] ?? ''
    expect(csp).toContain("script-src 'self' 'wasm-unsafe-eval'")
    expect(csp).not.toContain("'unsafe-eval'")
    expect(csp).toContain("default-src 'none'")
  })
})

describe('serveDist', () => {
  const dist = mkdtempSync(join(tmpdir(), 'automata-check-dist-'))
  mkdirSync(join(dist, 'assets'))
  writeFileSync(
    join(dist, 'index.html'),
    '<!doctype html><script type="module" src="./assets/a.js"></script>',
  )
  writeFileSync(join(dist, 'assets', 'a.js'), 'export {}')
  afterAll(() => rmSync(dist, { recursive: true, force: true }))

  it('serves the build with the given headers, the entry at /, and nothing outside dist', async () => {
    const server = await serveDist(dist, { 'Content-Security-Policy': "default-src 'none'" })
    try {
      const index = await fetch(server.url)
      expect(index.status).toBe(200)
      expect(index.headers.get('content-security-policy')).toBe("default-src 'none'")
      expect(index.headers.get('content-type')).toContain('text/html')
      const script = await fetch(new URL('assets/a.js', server.url))
      expect(script.headers.get('content-type')).toContain('text/javascript')
      expect((await fetch(new URL('missing.js', server.url))).status).toBe(404)
      expect((await fetch(`${server.url}%2e%2e/%2e%2e/etc/passwd`)).status).toBe(404)
    } finally {
      await server.close()
    }
  })
})
