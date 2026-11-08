// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { framePageForOrigin } from '../scripts/playground-origin'

// R-2 (spec §11.2): a frame page's connect-src names the one origin that serves it. The published pages name the
// site's origin; the local servers (the static server and the dev server) serve them with their own.
const policy = (origin: string) =>
  `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'self' 'sha256-x='; connect-src 'self' ${origin}; frame-src 'none'" />`
const page = (origin: string) =>
  `<!doctype html><html><head>${policy(origin)}<title>https://automataframework.com</title></head></html>`

describe('framePageForOrigin', () => {
  it('names the given origin in connect-src and changes nothing else', () => {
    expect(framePageForOrigin(page('https://automataframework.com'), 'http://127.0.0.1:4650')).toBe(
      page('https://automataframework.com').replace(
        policy('https://automataframework.com'),
        policy('http://127.0.0.1:4650'),
      ),
    )
  })

  it('refuses a page with no connect-src origin, or a malformed origin', () => {
    expect(() => framePageForOrigin('<!doctype html><title>x</title>', 'http://127.0.0.1:4650')).toThrow(
      /connect-src/,
    )
    expect(() =>
      framePageForOrigin(page('https://automataframework.com'), 'http://127.0.0.1:4650/path'),
    ).toThrow(/origin/)
  })
})
