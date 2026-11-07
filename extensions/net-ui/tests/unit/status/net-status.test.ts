import { describe, expect, it } from 'vitest'
import { createNetStatus } from '#src/features/status/net-status.ts'

// The connection badge and the reconnect overlay as one state machine over `ConnectionState` and time: the badge
// is hidden offline, shows connecting, shows connected for two seconds, shows degraded while it lasts and reconnecting with the
// seconds left; the overlay shows reconnecting with a countdown, then Leave once the grace has passed.

const make = (graceSeconds = 30) => createNetStatus({ graceSeconds })

describe('the badge', () => {
  it('is hidden offline', () => {
    expect(make().update('offline', 0)).toMatchObject({ badge: 'hidden', overlay: 'hidden' })
  })
  it('shows connecting', () => {
    expect(make().update('connecting', 0).badge).toBe('connecting')
  })
  it('shows connected for two seconds and then hides', () => {
    const s = make()
    expect(s.update('connected', 1000).badge).toBe('connected')
    expect(s.update('connected', 2900).badge).toBe('connected')
    expect(s.update('connected', 3000).badge).toBe('hidden')
  })
  it('shows degraded for as long as it lasts, and connected again briefly once it clears', () => {
    const s = make()
    s.update('connected', 0)
    expect(s.update('degraded', 5000).badge).toBe('degraded')
    expect(s.update('degraded', 60_000).badge).toBe('degraded')
    expect(s.update('connected', 61_000).badge).toBe('connected')
    expect(s.update('connected', 63_500).badge).toBe('hidden')
  })
})

describe('reconnecting', () => {
  it('shows the seconds left in the badge and the overlay, rounding up', () => {
    const s = make(30)
    expect(s.update('reconnecting', 10_000)).toMatchObject({
      badge: 'reconnecting',
      overlay: 'reconnecting',
      secondsLeft: 30,
    })
    expect(s.update('reconnecting', 10_100).secondsLeft).toBe(30)
    expect(s.update('reconnecting', 19_000).secondsLeft).toBe(21)
    expect(s.update('reconnecting', 39_000).secondsLeft).toBe(1)
  })
  it('turns the overlay to expired, with Leave, once the grace has passed, and hides the badge', () => {
    const s = make(30)
    s.update('reconnecting', 0)
    expect(s.update('reconnecting', 30_000)).toMatchObject({
      badge: 'hidden',
      overlay: 'expired',
      secondsLeft: 0,
    })
  })
  it('starts the countdown again for a second drop', () => {
    const s = make(30)
    s.update('reconnecting', 0)
    s.update('connected', 5000)
    expect(s.update('reconnecting', 20_000).secondsLeft).toBe(30)
  })
  it('shows the overlay for no other state', () => {
    const s = make()
    for (const state of ['offline', 'connecting', 'connected', 'degraded'] as const)
      expect(s.update(state, 0).overlay).toBe('hidden')
  })
})
