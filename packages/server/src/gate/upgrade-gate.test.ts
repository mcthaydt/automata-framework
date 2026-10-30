import { EventEmitter } from 'node:events'
import type { IncomingMessage } from 'node:http'
import type { Duplex } from 'node:stream'
import { describe, expect, it } from 'vitest'
import { originPolicy } from './origins'
import { createSocketGate } from './socket-gate'
import { createUpgradeGate } from './upgrade-gate'

// Every socket upgrade passes the origin list and the socket counts before the transport sees it (spec §6, SV-c,
// SV-d; FloorFifty colyseus-server.ts' upgrade wrapper and public-surface.test.ts' socket cases, here on fake
// sockets so that holding a socket open never races a timer).

const RUKEN = 'https://g-abc.rukengames.com'

class FakeSocket extends EventEmitter {
  written = ''
  ended = false
  end(text: string): void {
    this.written = text
    this.ended = true
  }
  close(): void {
    this.emit('close')
  }
}

const upgrade = (origin: string | undefined, ip = '203.0.113.9'): IncomingMessage =>
  ({
    socket: { remoteAddress: ip },
    headers: origin === undefined ? {} : { origin },
  }) as unknown as IncomingMessage

function gateWith(limits: { maxPerIp: number; maxTotal: number }) {
  const refused: string[] = []
  const sockets = createSocketGate(limits)
  const gate = createUpgradeGate({
    origins: originPolicy([RUKEN]),
    sockets,
    onRefused: (code) => refused.push(code),
  })
  // `null` sends no Origin header (`undefined` would take the default).
  const open = (origin: string | null = RUKEN, ip?: string) => {
    const socket = new FakeSocket()
    return { socket, admitted: gate(upgrade(origin ?? undefined, ip), socket as unknown as Duplex) }
  }
  return { refused, sockets, open }
}

describe('the upgrade gate', () => {
  it('refuses a socket from an unlisted origin, or from none, with 403', () => {
    const { refused, sockets, open } = gateWith({ maxPerIp: 16, maxTotal: 100 })
    const other = open('https://elsewhere.test')
    const none = open(null)
    for (const { socket, admitted } of [other, none]) {
      expect(admitted).toBe(false)
      expect(socket.ended).toBe(true)
      expect(socket.written).toMatch(/^HTTP\/1\.1 403 Forbidden\r\n/)
    }
    expect(refused).toEqual(['origin', 'origin'])
    expect(sockets.open).toBe(0)
  })

  it('hands a listed origin on, and counts it', () => {
    const { refused, sockets, open } = gateWith({ maxPerIp: 16, maxTotal: 100 })
    const { socket, admitted } = open()
    expect(admitted).toBe(true)
    expect(socket.ended).toBe(false)
    expect(sockets.open).toBe(1)
    expect(refused).toEqual([])
  })

  it("refuses an address's socket past its cap with 429, and leaves the open ones alone", () => {
    const { refused, sockets, open } = gateWith({ maxPerIp: 2, maxTotal: 100 })
    const held = [open(), open()]
    const third = open()
    expect(third.admitted).toBe(false)
    expect(third.socket.written).toMatch(/^HTTP\/1\.1 429 Too Many Requests\r\n/)
    expect(held.every(({ socket }) => !socket.ended)).toBe(true)
    expect(sockets.open).toBe(2)
    expect(refused).toEqual(['sockets'])
    expect(open(RUKEN, '198.51.100.7').admitted).toBe(true)
  })

  it('refuses a socket past the total, whoever sends it', () => {
    const { open } = gateWith({ maxPerIp: 100, maxTotal: 1 })
    expect(open(RUKEN, '203.0.113.1').admitted).toBe(true)
    const second = open(RUKEN, '203.0.113.2')
    expect(second.admitted).toBe(false)
    expect(second.socket.written).toMatch(/^HTTP\/1\.1 429 /)
  })

  it('gives a closed socket its place back, once', () => {
    const { sockets, open } = gateWith({ maxPerIp: 1, maxTotal: 100 })
    const first = open()
    expect(open().admitted).toBe(false)
    first.socket.close()
    first.socket.close()
    expect(sockets.open).toBe(0)
    expect(open().admitted).toBe(true)
  })
})
