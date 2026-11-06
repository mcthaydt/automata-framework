// @vitest-environment node
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:https'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { certificateProblems, checkUptime } from '../scripts/check-uptime'

// QB.4b: the uptime and certificate-expiry check an external monitor runs against the origin. Until the Owner supplies
// the host and a monitor account, it runs against local servers: serve-static for status, and an https server with a
// short-lived certificate made by openssl for the expiry check.

const root = resolve(import.meta.dirname, '..')
const NOW = new Date('2026-10-31T00:00:00Z')
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000)
const ok = async () => new Response('ok', { status: 200 })

describe('certificateProblems', () => {
  it('passes a certificate with more days left than the threshold', () => {
    expect(certificateProblems(days(30), NOW, 21)).toEqual([])
  })

  it('flags one with fewer days left, and one that has expired', () => {
    expect(certificateProblems(days(20), NOW, 21)).toEqual(['the certificate expires in 20 days (2026-11-20), under the 21-day threshold'])
    expect(certificateProblems(days(-1), NOW, 21)).toEqual(['the certificate expired on 2026-10-30'])
  })
})

describe('checkUptime', () => {
  const options = { now: NOW, minCertDays: 21, certificate: async () => ({ validTo: days(60) }) }

  it('passes an https origin that answers 200 with a certificate far from expiry', async () => {
    expect(await checkUptime('https://site.example', { ...options, fetch: ok })).toEqual([])
  })

  it('flags a status other than 200, a failed request and one slower than the timeout', async () => {
    expect(await checkUptime('https://site.example', { ...options, fetch: async () => new Response('', { status: 503 }) }))
      .toEqual(['https://site.example/ answered 503'])
    expect(await checkUptime('https://site.example', { ...options, fetch: async () => { throw new Error('ECONNREFUSED') } }))
      .toEqual(['https://site.example/ did not answer: ECONNREFUSED'])
    const slow = (_url: string, init?: RequestInit) => new Promise<Response>((_done, fail) => {
      init?.signal?.addEventListener('abort', () => fail(new Error('aborted')))
    })
    expect(await checkUptime('https://site.example', { ...options, fetch: slow, timeoutMs: 20 }))
      .toEqual(['https://site.example/ did not answer within 20 ms'])
  })

  it('flags an expiring certificate, and a plain http origin unless it is allowed', async () => {
    expect(await checkUptime('https://site.example', { ...options, fetch: ok, certificate: async () => ({ validTo: days(3) }) }))
      .toEqual(['the certificate expires in 3 days (2026-11-03), under the 21-day threshold'])
    expect(await checkUptime('http://site.example', { ...options, fetch: ok })).toEqual(['http://site.example is not served over https'])
    expect(await checkUptime('http://site.example', { ...options, fetch: ok, allowHttp: true })).toEqual([])
  })
})

describe('the certificate a real https server presents', () => {
  const dir = mkdtempSync(join(tmpdir(), 'uptime-cert-'))
  let server: Server
  let origin: string
  beforeAll(async () => {
    execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '10', '-subj', '/CN=localhost',
      '-keyout', join(dir, 'key.pem'), '-out', join(dir, 'cert.pem')], { stdio: 'ignore' })
    server = createServer({ key: readFileSync(join(dir, 'key.pem')), cert: readFileSync(join(dir, 'cert.pem')) }, (_request, response) => response.end('ok'))
    await new Promise<void>(done => server.listen(0, '127.0.0.1', done))
    origin = `https://127.0.0.1:${(server.address() as AddressInfo).port}`
  })
  afterAll(() => { server?.close(); rmSync(dir, { recursive: true, force: true }) })

  // The self-signed certificate is not trusted, so the status request is faked; the handshake reads the real one.
  it('is read from the handshake: 10 days fails a 21-day threshold and passes a 5-day one', async () => {
    const [problem] = await checkUptime(origin, { minCertDays: 21, fetch: ok })
    expect(problem).toMatch(/^the certificate expires in (9|10) days \(\d{4}-\d{2}-\d{2}\), under the 21-day threshold$/)
    expect(await checkUptime(origin, { minCertDays: 5, fetch: ok })).toEqual([])
  })
})

describe('pnpm check:uptime', () => {
  const run = (...args: string[]) =>
    spawnSync(process.execPath, ['--import', 'tsx', 'scripts/check-uptime.ts', ...args], { cwd: root, encoding: 'utf8', timeout: 30_000 })

  it('--local serves the build and checks its status, saying the certificate was not checked', () => {
    const build = mkdtempSync(join(tmpdir(), 'uptime-build-'))
    try {
      writeFileSync(join(build, 'index.html'), '<!doctype html><title>x</title>')
      const result = run('--local', '--build', build)
      expect(result.stderr).toBe('')
      expect(result.status).toBe(0)
      expect(result.stdout).toContain('answered 200')
      expect(result.stdout).toContain('no certificate was checked')
    } finally {
      rmSync(build, { recursive: true, force: true })
    }
  })

  it('refuses both an origin and --local, and neither', () => {
    for (const args of [['https://site.example', '--local'], []]) {
      const result = run(...args)
      expect(result.status).toBe(2)
      expect(result.stderr).toContain('Usage: check-uptime.ts <origin> [--min-cert-days 21] | --local [--build build]')
    }
  })
})
