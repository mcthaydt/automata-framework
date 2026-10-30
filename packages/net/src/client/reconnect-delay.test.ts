import { describe, expect, it } from 'vitest'
import { reconnectDelay } from './reconnect-delay'

// FloorFifty `tests/client/managers/network/colyseus-network.test.ts` "the reconnect backoff" (M7 spec §4.2).
describe('the reconnect backoff', () => {
  it('doubles from 250 ms to a 2 s ceiling', () => {
    expect([0, 1, 2, 3, 4, 9].map((attempt) => reconnectDelay(attempt, () => 0.5))).toEqual([
      250, 500, 1_000, 2_000, 2_000, 2_000,
    ])
  })

  it('spreads each climbing step by up to a quarter either way, so a restart does not bring everyone back at once', () => {
    expect(reconnectDelay(0, () => 0)).toBe(187.5)
    expect(reconnectDelay(0, () => 1)).toBe(312.5)
    expect(reconnectDelay(2, () => 0)).toBe(750)
  })
})
