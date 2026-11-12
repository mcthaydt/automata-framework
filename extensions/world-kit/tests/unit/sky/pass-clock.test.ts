// The clock the world kit's moving passes (stars, rain, particles, shafts) run on: it follows the ticker and holds still
// while the player has asked for less movement, read at each tick.
import { describe, expect, it } from 'vitest'
import { passClock } from '#src/features/sky/pass-clock.ts'

describe('passClock', () => {
  it('adds each tick’s milliseconds as seconds', () => {
    const clock = passClock(() => false)
    clock.tick(250)
    expect(clock.tick(250)).toBeCloseTo(0.5, 9)
  })

  it('holds still under reduced motion, and goes on from where it held when the setting turns off', () => {
    let reduced = false
    const clock = passClock(() => reduced)
    clock.tick(2000)
    reduced = true
    expect(clock.tick(5000)).toBeCloseTo(2, 9)
    reduced = false
    expect(clock.tick(1000)).toBeCloseTo(3, 9)
  })
})
