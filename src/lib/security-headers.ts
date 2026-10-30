/**
 * The header set every response of the site carries (QB.4a; quality-bar spec QB.4). serve-static.ts sends it, so the
 * browser suite and Lighthouse run under it, and check-deployed.ts reads it back from an origin; the production host's
 * own configuration is written from this when the host is known (DX.12).
 *
 * The page policy is a <meta> in each page (csp.ts), because its script hashes are per page. The header adds what a
 * <meta> policy cannot carry, the frame policy: the site's pages, its demos and the playground's frames may be framed
 * by the site itself and by nothing else.
 */
export function securityHeaders(): Record<string, string> {
  return {
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Games may go full screen and read a gamepad; nothing on the site needs the camera, microphone, location,
    // payments or USB.
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self), gamepad=(self)',
    'Content-Security-Policy': "frame-ancestors 'self'",
  }
}
