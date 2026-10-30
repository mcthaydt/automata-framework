// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { DEMO_POLICY, securityHeaders } from '../src/lib/security-headers'

// QB.4a: the header set every response carries (quality-bar spec QB.4). A site page's script policy is a <meta> in the
// page (src/lib/csp.ts), so its header adds only what a <meta> cannot: the frame policy. The demos are copied in as
// built and never pass through the page hook, so their header carries their whole policy.
describe('securityHeaders', () => {
  it('is the set QB.4 names, with the frame policy alone in the CSP header of a site page', () => {
    expect(securityHeaders('/docs')).toEqual({
      'Strict-Transport-Security': 'max-age=86400; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self), gamepad=(self)',
      'Content-Security-Policy': "frame-ancestors 'self'",
    })
  })

  it('gives everything under /demos/ a whole policy: scripts from the site only, wasm allowed, no inline script', () => {
    expect(securityHeaders('/demos/base-2d/index.html')['Content-Security-Policy']).toBe(DEMO_POLICY)
    expect(DEMO_POLICY).toContain("script-src 'self' 'wasm-unsafe-eval';")
    expect(DEMO_POLICY).toContain("frame-ancestors 'self'")
    expect(DEMO_POLICY).not.toMatch(/'unsafe-inline'[^;]*;?\s*$|script-src[^;]*'unsafe-(inline|eval)'/)
    expect(securityHeaders('/demosx/')['Content-Security-Policy']).toBe("frame-ancestors 'self'")
  })
})
