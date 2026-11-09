import { describe, expect, it } from 'vitest'
import { createSocketGate, SOCKET_HEADROOM, socketTotal } from '#src/features/gates/socket-gate.ts'

// Open sockets, per address and overall.

describe('the socket gate', () => {
  it('lets sixteen sockets open from one address, and refuses the seventeenth', () => {
    const gate = createSocketGate({ maxPerIp: 16, maxTotal: 1_000 })
    for (let index = 0; index < 16; index += 1) expect(gate.admit('203.0.113.9')).toBe(true)
    expect(gate.admit('203.0.113.9')).toBe(false)
    // The sixteen stay counted (nothing was closed to refuse the seventeenth), and another address is let in.
    expect(gate.open).toBe(16)
    expect(gate.admit('198.51.100.7')).toBe(true)
  })

  it('lets the next one in once one closes', () => {
    const gate = createSocketGate({ maxPerIp: 2, maxTotal: 1_000 })
    gate.admit('a')
    gate.admit('a')
    expect(gate.admit('a')).toBe(false)
    gate.release('a')
    expect(gate.admit('a')).toBe(true)
  })

  it('caps the total across addresses', () => {
    const gate = createSocketGate({ maxPerIp: 16, maxTotal: 3 })
    expect(['a', 'b', 'c', 'd'].map((ip) => gate.admit(ip))).toEqual([true, true, true, false])
  })

  it('returns to empty after every socket closes, and forgets the address', () => {
    const gate = createSocketGate({ maxPerIp: 16, maxTotal: 100 })
    for (const ip of ['a', 'a', 'b']) gate.admit(ip)
    for (const ip of ['a', 'a', 'b']) gate.release(ip)
    expect(gate.open).toBe(0)
    expect(gate.addresses).toBe(0)
  })

  it('never counts below zero for a release it did not admit', () => {
    const gate = createSocketGate({ maxPerIp: 1, maxTotal: 1 })
    gate.release('ghost')
    expect(gate.open).toBe(0)
    expect(gate.admit('a')).toBe(true)
    expect(gate.admit('b')).toBe(false)
  })
})

describe("the server's socket total", () => {
  it('is a socket per seat in every room the server may hold, plus headroom for joins in flight', () => {
    expect(SOCKET_HEADROOM).toBe(64)
    expect(socketTotal(25, 4)).toBe(25 * 4 + 64)
    expect(socketTotal(1, 1)).toBe(65)
  })
})
