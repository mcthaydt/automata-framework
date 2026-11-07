import { describe, expect, it } from 'vitest'
import { ANOMALY_COOLDOWN_MS, createAnomalyLimiter, slowStepMs } from './room-telemetry'

// Room telemetry as log events (M7 spec §4.3 table, FloorFifty `room-telemetry.ts`' anomaly cooldown).

describe('createAnomalyLimiter', () => {
  const limiter = () => {
    let now = 0
    const allows = createAnomalyLimiter(() => now)
    return { allows, at: (ms: number) => (now = ms) }
  }

  it.each(['tick.slow', 'step.slow', 'input.late'])(
    'logs the first %s, none within the cooldown, and one after',
    (event) => {
      const { allows, at } = limiter()
      expect(allows({ event, seat: 0 })).toBe(true)
      at(ANOMALY_COOLDOWN_MS - 1)
      expect(allows({ event, seat: 0 })).toBe(false)
      at(ANOMALY_COOLDOWN_MS)
      expect(allows({ event, seat: 0 })).toBe(true)
    },
  )

  it('keeps one cooldown per kind, and input.late one per seat', () => {
    const { allows } = limiter()
    expect(allows({ event: 'tick.slow' })).toBe(true)
    expect(allows({ event: 'step.slow' })).toBe(true)
    expect(allows({ event: 'input.late', seat: 0 })).toBe(true)
    expect(allows({ event: 'input.late', seat: 1 })).toBe(true)
    expect(allows({ event: 'input.late', seat: 1 })).toBe(false)
  })

  it('always passes every other event', () => {
    const { allows } = limiter()
    for (let i = 0; i < 3; i += 1) {
      expect(allows({ event: 'refused', code: 'rate' })).toBe(true)
      expect(allows({ event: 'seat.joined', seat: 0 })).toBe(true)
    }
  })
})

describe('slowStepMs', () => {
  it('is half the tick budget (FloorFifty SLOW_TICK_MS)', () => {
    expect(slowStepMs(60)).toBeCloseTo(1000 / 120)
    expect(slowStepMs(30)).toBeCloseTo(1000 / 60)
  })
})
