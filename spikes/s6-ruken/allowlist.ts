function parse(origin: string): URL | null {
  try {
    return new URL(origin)
  } catch {
    return null
  }
}

function isLocalGame(game: URL): boolean {
  const h = game.hostname
  return game.protocol === 'http:' && (h === 'localhost' || h === '127.0.0.1' || h.endsWith('.localhost'))
}

/** P01 §4 HOST_ALLOWLIST. Compares parsed URL parts, never string prefixes. */
export function isAllowedHostOrigin(hostOrigin: string, gameOrigin: string): boolean {
  const host = parse(hostOrigin)
  if (!host) return false
  const h = host.hostname
  // 1. Ruken web: https, default port, ruken.com or any subdomain depth.
  if (host.protocol === 'https:' && host.port === '' && (h === 'ruken.com' || h.endsWith('.ruken.com')))
    return true
  // 2. Desktop.
  if (['tauri://localhost', 'http://tauri.localhost', 'https://tauri.localhost'].includes(hostOrigin))
    return true
  // 3. Local development, only when the game itself is local.
  const game = parse(gameOrigin)
  return (
    host.protocol === 'http:' &&
    (h === 'localhost' || h === '127.0.0.1') &&
    game !== null &&
    isLocalGame(game)
  )
}
