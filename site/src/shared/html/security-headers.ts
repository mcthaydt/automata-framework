/**
 * The header set every response of the site carries. serve-static.ts sends it, so the
 * browser suite and Lighthouse run under it. When the host is known
 * its configuration is written from this and from the playground's own headers (src/features/playground/headers.ts).
 *
 * A site page's policy is a <meta> in the page (csp.ts), because its script hashes are per page; the header adds what a
 * <meta> policy cannot carry, the frame policy: the site's pages, its demos and the playground's frames may be framed by
 * the site itself and by nothing else. The demos under /demos/ and the try-it editor under /editor/app/ are copied in as
 * the framework built them and never pass through the page hook, so their header carries their whole policy
 * (DEMO_POLICY).
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

/**
 * The editors' policy at /editor/app/: the demos' own, and one more place to connect to. A signed-in person's games go
 * from the page straight to GitHub's API, so `connect-src` also names it and nothing else.
 */
export const EDITOR_POLICY = DEMO_POLICY.replace("connect-src 'self'", "connect-src 'self' https://api.github.com")

/**
 * An example page's preview runs in a sandboxed frame with an opaque origin, which `(self)` never matches,
 * so example pages and the frame pages they load allow fullscreen and the gamepad to any origin. A frame still gets a
 * feature only through its `allow` attribute, and only the playground's frames carry one.
 */
const PREVIEW_PAGE = /^\/(examples|playground\/examples)\/[^/]/

/** The framework's own builds the site serves as they are: the demos and the try-it editor. */
const FRAMEWORK_BUILD = /^\/(demos|editor\/app)\//
const EDITORS = /^\/editor\/app\//

export function securityHeaders(pathname: string): Record<string, string> {
  const delegated = PREVIEW_PAGE.test(pathname)
    ? 'fullscreen=*, gamepad=*'
    : 'fullscreen=(self), gamepad=(self)'
  return {
    // One day while the host is new: a broken certificate then locks returning readers out for a day, not a year.
    // It becomes a year once the live origin has passed `pnpm check:deployed` for a week.
    'Strict-Transport-Security': 'max-age=86400; includeSubDomains',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // Games may go full screen and read a gamepad; nothing on the site needs the camera, microphone, location,
    // payments or USB.
    'Permissions-Policy': `camera=(), microphone=(), geolocation=(), payment=(), usb=(), ${delegated}`,
    'Content-Security-Policy': EDITORS.test(pathname)
      ? EDITOR_POLICY
      : FRAMEWORK_BUILD.test(pathname)
        ? DEMO_POLICY
        : FRAME_POLICY,
  }
}
