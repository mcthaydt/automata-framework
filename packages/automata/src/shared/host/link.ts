/** The longest address a host is asked to open (the Ruken SDK's own limit). */
const MAX_LINK_LENGTH = 2048

/**
 * True when `url` is an address a host may be asked to open: an `https:` URL with a host name and no name or password
 * in it. Every target applies the same rule, so a link that works on one target never fails on another, and nothing a
 * page's own text could smuggle in (`javascript:`, `data:`, `http:`) ever reaches a host.
 */
export function isOpenableLink(url: string): boolean {
  if (url.length > MAX_LINK_LENGTH) return false
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  return (
    parsed.protocol === 'https:' && parsed.hostname !== '' && parsed.username === '' && parsed.password === ''
  )
}
