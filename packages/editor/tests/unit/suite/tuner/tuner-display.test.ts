import { describe, expect, it } from 'vitest'
import type { Tunable } from '#src/features/suite/tuner/tuner-content.ts'
import { rawValue, shownBounds, shownValue } from '#src/features/suite/tuner/tuner-display.ts'

// The Tuner shows a scaled tunable in a unit a player can feel (pixels a second, seconds) and writes back the sim's
// own whole number: what is shown is the value times its scale, rounded to what one step changes.
const speed: Tunable = {
  name: 'MAX_RUN',
  kind: 'int',
  value: 384,
  min: 128,
  max: 768,
  step: 1,
  authored: true,
  editable: true,
  unit: 'px/s',
  scale: 0.234375,
}
const jump: Tunable = { ...speed, name: 'JUMP_SPEED', value: -448, min: -1024, max: -128, scale: -0.234375 }
const ticks: Tunable = { ...speed, name: 'COYOTE_TICKS', value: 6, min: 0, max: 15, unit: 's', scale: 1 / 60 }
const { unit: _unit, scale: _scale, ...plain }: Tunable = speed

describe('the Tuner shows values in a unit a player can feel', () => {
  it('shows the value times its scale, rounded to what one step changes', () => {
    expect(shownValue(speed, 384)).toBe(90)
    expect(shownValue(speed, 385)).toBe(90.2)
    expect(shownValue(ticks, 6)).toBe(0.1)
    expect(shownValue(jump, -448)).toBe(105)
  })

  it('writes back the nearest whole step in the sim’s units', () => {
    expect(rawValue(speed, 90)).toBe(384)
    expect(rawValue(speed, 100)).toBe(427)
    expect(rawValue(ticks, 0.2)).toBe(12)
    expect(rawValue(jump, 120)).toBe(-512)
  })

  it('shows the bounds in the unit, smallest first even when the scale turns them round', () => {
    expect(shownBounds(speed)).toEqual({ min: 30, max: 180, step: 0.2 })
    expect(shownBounds(jump)).toEqual({ min: 30, max: 240, step: 0.2 })
    expect(shownBounds(ticks)).toEqual({ min: 0, max: 0.25, step: 0.02 })
  })

  it('leaves a tunable with no scale as it is', () => {
    expect(shownValue(plain, 384)).toBe(384)
    expect(rawValue(plain, 400)).toBe(400)
    expect(shownBounds(plain)).toEqual({ min: 128, max: 768, step: 1 })
  })
})
