// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { securityHeaders } from '#src/shared/html/security-headers.ts'
import { deployedProblems, type Probe } from '../../../scripts/check-deployed.ts'

const ORIGIN = 'https://automataframework.com'

/** A host that answers every address as the site means to, and the missing one with the 404 page. */
function goodHost(change: (path: string, probe: Probe) => Probe = (_p, probe) => probe) {
  return async (url: string): Promise<Probe> => {
    const path = new URL(url).pathname
    const missing = path === '/no-such-page'
    const headers = new Headers(securityHeaders(path))
    // The old Editor address is a rule on the host: a 301 to the editor itself.
    if (path === '/editor') {
      headers.set('Location', '/editor/app/')
      return change(path, { status: 301, headers, body: '' })
    }
    // The host adds headers of its own; they are not the site's to judge.
    headers.set('Access-Control-Allow-Origin', '*')
    return change(path, {
      status: missing ? 404 : 200,
      headers,
      body: missing ? '<h1>Page not found</h1>' : '<h1>Page</h1>',
    })
  }
}

describe('deployedProblems', () => {
  it('is empty when every probe matches', async () => {
    expect(await deployedProblems(ORIGIN, goodHost())).toEqual([])
  })

  it('names the path and the header that differ', async () => {
    const host = goodHost((path, probe) => {
      if (path === '/demos/emberwick/') probe.headers.set('Content-Security-Policy', "frame-ancestors 'self'")
      return probe
    })
    const problems = await deployedProblems(ORIGIN, host)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('/demos/emberwick/: Content-Security-Policy')
  })

  it('names a header the host does not send at all', async () => {
    const host = goodHost((path, probe) => {
      if (path === '/') probe.headers.delete('Strict-Transport-Security')
      return probe
    })
    expect(await deployedProblems(ORIGIN, host)).toEqual(['/: Strict-Transport-Security is missing'])
  })

  it('needs a missing address to answer 404 with the page', async () => {
    const wrongStatus = goodHost((path, probe) =>
      path === '/no-such-page' ? { ...probe, status: 200 } : probe,
    )
    expect(await deployedProblems(ORIGIN, wrongStatus)).toContain('/no-such-page: answered 200, not 404')
    const emptyBody = goodHost((path, probe) => (path === '/no-such-page' ? { ...probe, body: '' } : probe))
    expect(await deployedProblems(ORIGIN, emptyBody)).toContain(
      '/no-such-page: the 404 answer is not the "Page not found" page',
    )
  })

  it('says so when the host cannot be reached', async () => {
    expect(
      await deployedProblems(ORIGIN, async () => {
        throw new Error('timeout')
      }),
    ).toContain('/: could not be fetched (timeout)')
  })

  it('needs /editor to answer 301 to /editor/app/, as the host’s redirect rule says', async () => {
    const wrongStatus = goodHost((path, probe) => (path === '/editor' ? { ...probe, status: 200 } : probe))
    expect(await deployedProblems(ORIGIN, wrongStatus)).toContain('/editor: answered 200, not 301')
    const wrongPlace = goodHost((path, probe) => {
      if (path === '/editor') probe.headers.set('Location', '/docs')
      return probe
    })
    expect(await deployedProblems(ORIGIN, wrongPlace)).toContain(
      '/editor: Location is /docs, not /editor/app/',
    )
    const noLocation = goodHost((path, probe) => {
      if (path === '/editor') probe.headers.delete('Location')
      return probe
    })
    expect(await deployedProblems(ORIGIN, noLocation)).toContain('/editor: Location is missing')
  })
})
