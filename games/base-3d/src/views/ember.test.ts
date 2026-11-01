// The ember's look: the pulse stays within ±14% and the goal is larger, gold and has a beam, so it reads from afar.
import { describe, expect, it } from 'vitest'
import { EMBER_LOOK, GOAL_LOOK, pulse, turn } from './ember.ts'

describe('the ember look', () => {
  it('pulses within 1 ± 0.14 and turns steadily', () => {
    for (let tenth = 0; tenth < 100; tenth++) {
      const scale = pulse(tenth / 10, 1.3)
      expect(scale).toBeGreaterThanOrEqual(0.86)
      expect(scale).toBeLessThanOrEqual(1.14)
    }
    expect(turn(2)).toBe(3)
  })

  it('makes the goal larger, gold, and the only one with a beam over it', () => {
    expect(GOAL_LOOK.side).toBeGreaterThan(EMBER_LOOK.side)
    expect(GOAL_LOOK.core).not.toBe(EMBER_LOOK.core)
    expect(GOAL_LOOK.beam?.height).toBeGreaterThan(3)
    expect(EMBER_LOOK.beam).toBeUndefined()
  })
})
