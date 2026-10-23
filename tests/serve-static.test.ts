// @vitest-environment node
import { spawn, type ChildProcess } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { brotliCompressSync, gzipSync } from 'node:zlib'
import { afterAll, describe, expect, it } from 'vitest'

// scripts/serve-static.ts serves the prerendered build to the browser suite and, with `--compressed`, to Lighthouse.
// In that mode it answers like the production host will: the precompressed `.br` or `.gz` sibling that adapter-static
// wrote when the request accepts it, else the plain file. Lighthouse's transfer sizes depend on it.

const root = resolve(import.meta.dirname, '..')
const dir = mkdtempSync(join(tmpdir(), 'serve-static-'))
const html = '<!doctype html><title>x</title><p>original</p>'
writeFileSync(join(dir, 'page.html'), html)
writeFileSync(join(dir, 'page.html.br'), brotliCompressSync(html))
writeFileSync(join(dir, 'page.html.gz'), gzipSync(html))
mkdirSync(join(dir, 'lonely'))
writeFileSync(join(dir, 'lonely', 'index.html'), html)
writeFileSync(join(dir, '404.html'), '<title>gone</title>')

const servers: ChildProcess[] = []
afterAll(() => {
  for (const server of servers) server.kill()
  rmSync(dir, { recursive: true, force: true })
})

async function freePort(): Promise<number> {
  return new Promise(resolvePort => {
    const probe = createServer().listen(0, '127.0.0.1', () => {
      const { port } = probe.address() as { port: number }
      probe.close(() => resolvePort(port))
    })
  })
}

async function serve(...flags: string[]): Promise<string> {
  const port = await freePort()
  const server = spawn(process.execPath, ['--import', 'tsx', 'scripts/serve-static.ts', dir, String(port), ...flags], { cwd: root })
  servers.push(server)
  await new Promise<void>((done, fail) => {
    server.stdout.on('data', chunk => { if (String(chunk).includes('Serving')) done() })
    server.on('exit', code => fail(new Error(`serve-static exited with ${code}`)))
  })
  return `http://127.0.0.1:${port}`
}

describe('serve-static', () => {
  it('serves the plain file by default, even when the request accepts brotli', async () => {
    const origin = await serve()
    const response = await fetch(`${origin}/page`, { headers: { 'accept-encoding': 'br' } })
    expect(response.headers.get('content-encoding')).toBeNull()
    expect(await response.text()).toBe(html)
  })

  it('--compressed serves brotli to a request that accepts it, and the page still reads the same', async () => {
    const origin = await serve('--compressed')
    const response = await fetch(`${origin}/page`, { headers: { 'accept-encoding': 'br, gzip' } })
    expect(response.headers.get('content-encoding')).toBe('br')
    expect(response.headers.get('vary')).toBe('Accept-Encoding')
    expect(response.headers.get('content-type')).toBe('text/html; charset=utf-8')
    expect(await response.text()).toBe(html)
  })

  it('--compressed falls back to gzip, then to the plain file', async () => {
    const origin = await serve('--compressed')
    const gzip = await fetch(`${origin}/page`, { headers: { 'accept-encoding': 'gzip' } })
    expect(gzip.headers.get('content-encoding')).toBe('gzip')
    expect(await gzip.text()).toBe(html)
    const plain = await fetch(`${origin}/page`, { headers: { 'accept-encoding': 'identity' } })
    expect(plain.headers.get('content-encoding')).toBeNull()
    expect(await plain.text()).toBe(html)
  })

  it('--compressed serves a file with no compressed sibling as it is, and still answers 404 for a missing page', async () => {
    const origin = await serve('--compressed')
    const lonely = await fetch(`${origin}/lonely/`, { headers: { 'accept-encoding': 'br' } })
    expect(lonely.headers.get('content-encoding')).toBeNull()
    expect(await lonely.text()).toBe(html)
    const missing = await fetch(`${origin}/nope`, { headers: { 'accept-encoding': 'br' } })
    expect(missing.status).toBe(404)
  })
})
