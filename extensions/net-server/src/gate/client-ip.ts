/**
 * Who a request is from, for the per-address limits (FloorFifty `gate/client-ip.ts`, unchanged in rules).
 *
 * The TCP peer, unless the peer is the reverse proxy on loopback (Caddy, spec §4.6), in which case the proxy's last
 * hop: the address the proxy itself saw. A header from anyone else is the sender's own claim and is ignored, so it
 * cannot be used to dodge a limit. The address is a limit key only: it is never logged (spec §4.5).
 */

import type { IncomingMessage } from 'node:http'

const LOOPBACK = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1'])

export function clientIp(request: IncomingMessage): string {
  const peer = request.socket.remoteAddress ?? 'unknown'
  const forwarded = request.headers['x-forwarded-for']
  if (!LOOPBACK.has(peer) || typeof forwarded !== 'string') return limitKey(peer)
  const last = forwarded.split(',').at(-1)?.trim() ?? ''
  return limitKey(last === '' ? peer : last)
}

/**
 * The key an address is limited by. IPv4 stays whole; an IPv4-mapped IPv6 address is its IPv4; any other IPv6
 * address is its /64, because one subscriber holds a whole /64 and could otherwise take fresh limits by changing its
 * address.
 */
function limitKey(address: string): string {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)
  if (mapped?.[1] !== undefined) return mapped[1]
  if (!address.includes(':')) return address
  const compressed = address.includes('::')
  const [head = '', tail = ''] = address.split('::')
  const front = head === '' ? [] : head.split(':')
  const back = compressed ? (tail === '' ? [] : tail.split(':')) : []
  const groups = compressed
    ? [...front, ...Array<string>(Math.max(0, 8 - front.length - back.length)).fill('0'), ...back]
    : front
  const prefix = groups.slice(0, 4).map((group) => Number.parseInt(group || '0', 16).toString(16))
  return `${prefix.join(':')}::/64`
}
