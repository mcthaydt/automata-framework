// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { DEMO_POLICY, securityHeaders } from '../../../src/shared/html/security-headers'

// QB.4a: the header set every response carries (quality-bar spec QB.4). A site page's script policy is a <meta> in the
// page (src/shared/html/csp.ts), so its header adds only what a <meta> cannot: the frame policy. The demos are copied in as
// built and never pass through the page hook, so their header carries their whole policy.
describe('securityHeaders', () => {
  it('is the set QB.4 names, with the frame policy alone in the CSP header of a site page', () => {
    expect(securityHeaders('/docs')).toEqual({
      'Strict-Transport-Security': 'max-age=86400; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy':
        'camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self), gamepad=(self)',
      'Content-Security-Policy': "frame-ancestors 'self'",
    })
  })

  it('gives everything under /demos/ a whole policy: scripts from the site only, wasm allowed, no inline script', () => {
    expect(securityHeaders('/demos/base-2d/index.html')['Content-Security-Policy']).toBe(DEMO_POLICY)
    // The try-it editor is the framework's build too, served as it is.
    expect(securityHeaders('/editor/app/')['Content-Security-Policy']).toBe(DEMO_POLICY)
    expect(securityHeaders('/editor')['Content-Security-Policy']).not.toBe(DEMO_POLICY)
    expect(DEMO_POLICY).toContain("script-src 'self' 'wasm-unsafe-eval';")
    expect(DEMO_POLICY).toContain("frame-ancestors 'self'")
    expect(DEMO_POLICY).not.toMatch(/'unsafe-inline'[^;]*;?\s*$|script-src[^;]*'unsafe-(inline|eval)'/)
    expect(securityHeaders('/demosx/')['Content-Security-Policy']).toBe("frame-ancestors 'self'")
  })

  // WEB.PLAY.5: an example page's preview is a sandboxed frame with an opaque origin, which `(self)` never matches, so
  // the input examples' getGamepads() threw "disallowed by permissions policy". Example pages and the frame pages they
  // load allow the two features to any origin; a frame still gets them only through its `allow` attribute, which only
  // the playground's frames carry. Every other page keeps `(self)`.
  it('lets an example page delegate fullscreen and the gamepad to its opaque preview frame, and no other page', () => {
    for (const path of ['/examples/core-saves', '/playground/examples/core/saves/']) {
      const policy = securityHeaders(path)['Permissions-Policy']
      expect(policy, path).toContain('fullscreen=*')
      expect(policy, path).toContain('gamepad=*')
      expect(policy, path).toContain('camera=()')
    }
    for (const path of ['/examples', '/docs', '/', '/playground/runtime/assets/x.js']) {
      expect(securityHeaders(path)['Permissions-Policy'], path).toContain('gamepad=(self)')
    }
  })
})
