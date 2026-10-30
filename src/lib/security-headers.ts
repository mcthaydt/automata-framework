/**
 * The header set every response of the site carries (QB.4a; quality-bar spec QB.4). serve-static.ts sends it, so the
 * browser suite and Lighthouse run under it, and check-deployed.ts reads it back from an origin. When the host is known
 * (DX.12) its configuration is written from this and from the playground's own headers (src/lib/playground/headers.ts).
 *
 * A site page's policy is a <meta> in the page (csp.ts), because its script hashes are per page; the header adds what a
 * <meta> policy cannot carry, the frame policy: the site's pages, its demos and the playground's frames may be framed by
 * the site itself and by nothing else. The demos under /demos/ are copied in as the framework built them and never pass
 * through the page hook, so their header carries their whole policy (DEMO_POLICY).
 */
const FRAME_POLICY = "frame-ancestors 'self'"

/**
 * The site's policy for its demos, which run on the site's own origin inside DemoRunner's frame. Scripts and workers
 * come from the site only, with WebAssembly compiled (the physics demo's Rapier) but no eval and no inline script;
 * Pixi's images may be data: or blob: URLs. This is the site's own choice for its origin, not Ruken's policy: a game
 * published to Ruken gets Ruken's headers from @ruken/manifest.
 */
export const DEMO_POLICY = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  FRAME_POLICY,
].join('; ')

export function securityHeaders(pathname: string): Record<string, string> {
  return {
    // One day while the host is new: a broken certificate then locks returning readers out for a day, not a year.
    // QB.4 raises it to a year once the live origin has passed `pnpm check:deployed` for a week.
    'Strict-Transport-Security': 'max-age=86400; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Games may go full screen and read a gamepad; nothing on the site needs the camera, microphone, location,
    // payments or USB.
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), fullscreen=(self), gamepad=(self)',
    'Content-Security-Policy': pathname.startsWith('/demos/') ? DEMO_POLICY : FRAME_POLICY,
  }
}
