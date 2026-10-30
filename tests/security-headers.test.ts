// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { securityHeaders } from '../src/lib/security-headers'

// QB.4a: the header set every response carries (quality-bar spec QB.4). The page policy itself is a <meta> in each
// page (src/lib/csp.ts); the header adds what a <meta> cannot: the frame policy.
describe('securityHeaders', () => {
  it('is the set QB.4 names', () => {
    expect(securityHeaders()).toEqual({
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self), gamepad=(self)',
      'Content-Security-Policy': "frame-ancestors 'self'",
    })
  })
})
