// The response headers for the playground's files (website playground spec §11.3). A playground frame has an opaque
// origin, so every module, stylesheet, texture, sound and golden it loads is a cross-origin request with
// `Origin: null`: it needs CORS, and a cross-origin resource policy so a site-wide `same-origin` one cannot block it.
// The runtime's file names are content hashed, so they are cached for good; everything else revalidates.
const CROSS_ORIGIN = {
  'Access-Control-Allow-Origin': '*',
  'Cross-Origin-Resource-Policy': 'cross-origin',
} as const

/** The headers to add to the response for `pathname`; none outside `/playground/`. */
export function playgroundHeaders(pathname: string): Record<string, string> {
  if (!pathname.startsWith('/playground/')) return {}
  const cacheControl = pathname.startsWith('/playground/runtime/')
    ? 'public, max-age=31536000, immutable'
    : 'no-cache'
  return { ...CROSS_ORIGIN, 'Cache-Control': cacheControl }
}
