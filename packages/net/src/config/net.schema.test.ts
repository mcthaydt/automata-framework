import { describe, expect, it } from 'vitest'
import { netConfigSchema } from './net.schema'

// content/net.toml (M7 spec §4.2, NetConfig): defaults in brackets there.

describe('netConfigSchema', () => {
  it('fills the defaults', () => {
    expect(netConfigSchema.parse({ url: 'wss://play.example.com' })).toEqual({
      url: 'wss://play.example.com',
      snapshotEvery: 3,
      maxLeadTicks: 60,
      interpolationTicks: 6,
      reconnectGraceSeconds: 30,
    })
  })

  it('accepts ws:// for a local server', () => {
    expect(netConfigSchema.safeParse({ url: 'ws://localhost:2567' }).success).toBe(true)
  })

  it.each([
    ['an http URL', { url: 'https://play.example.com' }],
    ['a URL with a path', { url: 'wss://play.example.com/rooms' }],
    ['a zero snapshotEvery', { url: 'wss://a.example', snapshotEvery: 0 }],
    ['a fractional interpolationTicks', { url: 'wss://a.example', interpolationTicks: 1.5 }],
    ['a grace past ten minutes', { url: 'wss://a.example', reconnectGraceSeconds: 601 }],
    ['an unknown key', { url: 'wss://a.example', tickHz: 60 }],
  ])('refuses %s', (_, value) => {
    expect(netConfigSchema.safeParse(value).success).toBe(false)
  })
})
