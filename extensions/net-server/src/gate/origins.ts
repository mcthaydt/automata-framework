/**
 * Which pages may use this server (FloorFifty `gate/origins.ts`; spec §4.3 `allowedOrigins`, §6, SV-d).
 *
 * `allowedOrigins` lists the client origins, matched exactly: the game's Ruken origin (`gameOrigin`), and any web
 * or itch.io origin it is also served from. Unlike FloorFifty, there is no "unset allows everything": a server
 * without a list refuses to start (SV-d), and a dev server lists its dev origin.
 *
 * This keeps other websites from using the server from their pages. It does not stop a script that forges the
 * header; the per-address limits are for that.
 */

export interface OriginPolicy {
  /** Whether a request or socket from `origin` may proceed. */
  allows(origin: string | undefined): boolean
  /** The CORS headers an answer to `origin` carries. */
  corsHeaders(origin: string | undefined): Record<string, string>
  /** The listed origins. */
  readonly origins: readonly string[]
}

/** `scheme://host[:port]` and nothing after it: what a browser sends as `Origin`. */
function isOrigin(entry: string): boolean {
  try {
    const url = new URL(entry)
    return (url.protocol === 'https:' || url.protocol === 'http:') && url.origin === entry
  } catch {
    return false
  }
}

export function originPolicy(list: readonly string[]): OriginPolicy {
  if (list.length === 0) throw new Error('allowedOrigins is empty: list the origins the game is served from')
  for (const entry of list) {
    if (entry.trim() === '') throw new Error('allowedOrigins has a blank entry')
    if (!isOrigin(entry))
      throw new Error(`allowedOrigins: "${entry}" is not an origin (scheme://host[:port])`)
  }
  const origins = new Set(list)
  const allows = (origin: string | undefined): origin is string => origin !== undefined && origins.has(origin)
  return {
    allows,
    corsHeaders: (origin) =>
      allows(origin) ? { 'access-control-allow-origin': origin, vary: 'Origin' } : { vary: 'Origin' },
    origins: [...list],
  }
}

/**
 * The seam for Ruken's `gameOrigin(publicId, env, channel)` (`@ruken/manifest`). No core pack exports it yet, and a
 * Ruken contract is never copied here, so the deploy computes the origin and this lists it, refusing anything that
 * is not an exact origin. Once a core pack exposes `gameOrigin`, this calls it (a request to core, M7.4a plan).
 */
export function originsFromGameOrigin(origin: string): readonly string[] {
  if (!isOrigin(origin)) throw new Error(`gameOrigin: "${origin}" is not an origin (scheme://host[:port])`)
  return [origin]
}
