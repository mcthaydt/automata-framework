// R-2: WebKit does not match a frame page's `'self'` to the site for a fetch, so each frame page's
// connect-src names the one origin that serves it. The published pages are built for the site's origin; the local
// servers (scripts/serve-static.ts and the dev server) answer with the same page naming their own.

const CONNECT_SRC = /(connect-src 'self' )([a-z][a-z0-9+.-]*:\/\/[^\s;"']+)/

/** Whether a playground path is a frame page (`/playground/examples/<module>/<name>/` or its index.html). */
export function isFramePage(pathname: string): boolean {
  return /^\/playground\/examples\/(?!resources\/)[^/]+\/[^/]+\/(index\.html)?$/.test(pathname)
}

/** The frame page with `origin` in place of the origin its connect-src names. */
export function framePageForOrigin(html: string, origin: string): string {
  if (new URL(origin).origin !== origin) throw new Error(`${origin} is not an origin`)
  if (!CONNECT_SRC.test(html)) throw new Error('the frame page has no connect-src origin to replace')
  return html.replace(CONNECT_SRC, (_, prefix: string) => `${prefix}${origin}`)
}
