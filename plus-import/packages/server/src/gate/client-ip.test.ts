import type { IncomingMessage } from 'node:http'
import { describe, expect, it } from 'vitest'
import { clientIp } from './client-ip'

// Who a request is from, for the per-address limits (FloorFifty tests/server/gate/client-ip.test.ts, all six cases).

const request = (remoteAddress: string | undefined, xff?: string): IncomingMessage =>
  ({
    socket: { remoteAddress },
    headers: xff === undefined ? {} : { 'x-forwarded-for': xff },
  }) as unknown as IncomingMessage

describe('the client address', () => {
  it('is the TCP peer', () => {
    expect(clientIp(request('203.0.113.9'))).toBe('203.0.113.9')
  })

  it('ignores X-Forwarded-For from anyone but loopback, so it cannot be forged', () => {
    expect(clientIp(request('203.0.113.9', '1.2.3.4'))).toBe('203.0.113.9')
  })

  it("takes Caddy's last hop when Caddy forwards", () => {
    expect(clientIp(request('::ffff:127.0.0.1', '1.2.3.4, 198.51.100.7'))).toBe('198.51.100.7')
    expect(clientIp(request('127.0.0.1', '198.51.100.7'))).toBe('198.51.100.7')
    expect(clientIp(request('::1', ' 198.51.100.8 '))).toBe('198.51.100.8')
  })

  it('falls back to the peer when loopback forwards nothing usable', () => {
    expect(clientIp(request('127.0.0.1'))).toBe('127.0.0.1')
    expect(clientIp(request('127.0.0.1', ' , '))).toBe('127.0.0.1')
  })

  // One IPv6 subscriber holds a whole /64, so the limits key on that, or a client could take fresh limits by
  // changing its address.
  it('keys an IPv6 address by its /64, and leaves IPv4 whole', () => {
    expect(clientIp(request('2001:db8:aaaa:bbbb:1:2:3:4'))).toBe('2001:db8:aaaa:bbbb::/64')
    expect(clientIp(request('2001:db8:aaaa:bbbb:ffff:ffff:ffff:ffff'))).toBe('2001:db8:aaaa:bbbb::/64')
    expect(clientIp(request('2001:db8::1'))).toBe('2001:db8:0:0::/64')
    expect(clientIp(request('::ffff:203.0.113.9'))).toBe('203.0.113.9')
    expect(clientIp(request('::ffff:127.0.0.1', '2001:db8:1:2::9'))).toBe('2001:db8:1:2::/64')
  })

  it('names a socket with no address rather than throwing', () => {
    expect(clientIp(request(undefined))).toBe('unknown')
  })
})
