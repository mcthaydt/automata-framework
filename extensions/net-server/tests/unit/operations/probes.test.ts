import { createServer, type Server } from 'node:http'
import { afterEach, describe, expect, it } from 'vitest'
import { installProbes, type Readiness, securityTxtBody } from '#src/features/operations/probes.ts'
import type { SecurityTxt } from '#src/shared/game/server-config.ts'

// `/health`, `/ready` and security.txt, on a bare listener on an ephemeral port.

const SECURITY: SecurityTxt = { contact: 'mailto:security@example.invalid', expires: '2027-10-30T00:00:00Z' }

let http: Server | undefined
afterEach(async () => {
  await new Promise((resolve) => http?.close(resolve) ?? resolve(undefined))
  http = undefined
})

/** A listener whose own handler answers 418 for everything, as Colyseus answers the paths it knows. */
async function start(state: { readiness: Readiness; securityTxt?: SecurityTxt }): Promise<string> {
  http = createServer((_request, response) => {
    response.writeHead(418).end('next')
  })
  installProbes(http, { readiness: () => state.readiness, securityTxt: state.securityTxt })
  await new Promise<void>((resolve) => http?.listen(0, '127.0.0.1', resolve))
  const address = http.address()
  if (typeof address !== 'object' || address === null) throw new Error('no address')
  return `http://127.0.0.1:${address.port}`
}

describe('/health', () => {
  it.each(['starting', 'ready', 'draining'] as const)(
    'answers 200 while %s, with no player data',
    async (readiness) => {
      const base = await start({ readiness })
      const response = await fetch(`${base}/health`)
      expect(response.status).toBe(200)
      expect(await response.json()).toEqual({ ok: true })
    },
  )
})

describe('/ready', () => {
  it.each([
    ['starting', 503, false],
    ['ready', 200, true],
    ['draining', 503, false],
    ['full', 503, false],
  ] as const)('while %s answers %d', async (readiness, status, ready) => {
    const base = await start({ readiness })
    const response = await fetch(`${base}/ready`)
    expect(response.status).toBe(status)
    expect(await response.json()).toEqual({ ready })
  })

  it('reads the state on every request', async () => {
    const state: { readiness: Readiness } = { readiness: 'starting' }
    const base = await start(state)
    expect((await fetch(`${base}/ready`)).status).toBe(503)
    state.readiness = 'ready'
    expect((await fetch(`${base}/ready?probe=1`)).status).toBe(200)
  })
})

describe('the probes’ headers', () => {
  it.each(['/health', '/ready'])('sends %s as JSON with no-store and nosniff', async (path) => {
    const base = await start({ readiness: 'ready' })
    const response = await fetch(`${base}${path}`)
    expect(response.headers.get('content-type')).toMatch(/^application\/json/)
    expect(response.headers.get('cache-control')).toBe('no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
  })
})

describe('security.txt', () => {
  it('is served at its well-known path with the configured contact and expiry', async () => {
    const base = await start({ readiness: 'ready', securityTxt: SECURITY })
    const response = await fetch(`${base}/.well-known/security.txt`)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toMatch(/^text\/plain/)
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    const text = await response.text()
    expect(text).toMatch(/^Contact: mailto:\S+@\S+$/m)
    expect(text).toContain(`Expires: ${SECURITY.expires}`)
  })

  it('is absent (404) when the server has no contact', async () => {
    const base = await start({ readiness: 'ready' })
    expect((await fetch(`${base}/.well-known/security.txt`)).status).toBe(404)
  })

  it('has the RFC 9116 fields, one per line', () => {
    expect(securityTxtBody(SECURITY)).toBe(
      `Contact: ${SECURITY.contact}\nExpires: ${SECURITY.expires}\nPreferred-Languages: en\n`,
    )
  })
})

describe('other paths', () => {
  it('fall through to the listener’s own handlers', async () => {
    const base = await start({ readiness: 'ready' })
    const response = await fetch(`${base}/matchmake/create/room`, { method: 'POST' })
    expect(response.status).toBe(418)
    expect(await response.text()).toBe('next')
  })
})
