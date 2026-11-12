// The film's clock drives the retro pass's grain, dust and scratch: it runs with the ticker and holds still while the player
// has asked for less movement. The setting is read at each tick, because it can change while the game is open.
import { describe, expect, it } from 'vitest'
import { filmClock } from '#src/features/retro/film-clock.ts'

describe('filmClock', () => {
  it('starts at zero and adds each tick’s milliseconds as seconds', () => {
    const clock = filmClock(() => false)
    expect(clock.tick(16)).toBeCloseTo(0.016, 9)
    expect(clock.tick(500)).toBeCloseTo(0.516, 9)
  })

  it('holds where it is while the player asks for less movement', () => {
    const clock = filmClock(() => true)
    expect(clock.tick(16)).toBe(0)
    expect(clock.tick(1000)).toBe(0)
  })

  it('reads the setting at each tick: it stops when it turns on and goes on from where it stopped when it turns off', () => {
    let reduced = false
    const clock = filmClock(() => reduced)
    clock.tick(1000)
    reduced = true
    expect(clock.tick(1000)).toBeCloseTo(1, 9)
    expect(clock.tick(1000)).toBeCloseTo(1, 9)
    reduced = false
    expect(clock.tick(500)).toBeCloseTo(1.5, 9)
  })
})
