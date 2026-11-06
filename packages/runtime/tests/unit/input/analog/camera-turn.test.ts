import { describe, expect, it } from 'vitest'
import {
  MAX_TURN_UNITS_PER_STEP,
  TURN_UNITS_PER_TURN,
  turnUnitsFromPixels,
} from '#src/input/analog/camera-turn.ts'

// Pixels to turn units (M4 spec §16.3.5, M3 spec §4.2): 65,536 units to a turn, an integer at most ±8,192 (45°) a
// step, so a replay stores integers only. Outside the sim: the game calls it when it makes `camera-turn`.
describe('turnUnitsFromPixels', () => {
  it('turns degrees per pixel into whole turn units (A-f)', () => {
    expect(TURN_UNITS_PER_TURN).toBe(65_536)
    // 4 px at 0.25° is 1°, 182.04 units.
    expect(turnUnitsFromPixels(4, 0.25, false)).toBe(182)
    expect(turnUnitsFromPixels(2, 0.25, false)).toBe(91)
    expect(turnUnitsFromPixels(-2, 0.25, false)).toBe(-91)
  })

  it('negates when the camera is inverted', () => {
    expect(turnUnitsFromPixels(4, 0.25, true)).toBe(-182)
    expect(turnUnitsFromPixels(-4, 0.25, true)).toBe(182)
  })

  it('rounds half away from zero, so left and right are the same size', () => {
    // 1 px at 360/65,536° per pixel is exactly 1 unit; half of that is a half unit.
    const unitPerPixel = 360 / TURN_UNITS_PER_TURN
    expect(turnUnitsFromPixels(0.5, unitPerPixel, false)).toBe(1)
    expect(turnUnitsFromPixels(-0.5, unitPerPixel, false)).toBe(-1)
  })

  it('clamps a step to 45°, ±8,192 units', () => {
    expect(MAX_TURN_UNITS_PER_STEP).toBe(8_192)
    // A 1,440 px sweep at 0.25° is a whole turn.
    expect(turnUnitsFromPixels(1_440, 0.25, false)).toBe(8_192)
    expect(turnUnitsFromPixels(-1_440, 0.25, false)).toBe(-8_192)
    expect(turnUnitsFromPixels(1_440, 0.25, true)).toBe(-8_192)
  })

  it('gives 0, never −0, for nothing or nonsense (A-m)', () => {
    for (const [dx, degPerPixel] of [
      [0, 0.25],
      [-0, 0.25],
      [Number.NaN, 0.25],
      [Number.POSITIVE_INFINITY, 0.25],
      [4, 0],
      [4, -0.25],
      [4, Number.NaN],
      [-0.0001, 0.25],
    ] as const) {
      expect(Object.is(turnUnitsFromPixels(dx, degPerPixel, false), 0)).toBe(true)
      expect(Object.is(turnUnitsFromPixels(dx, degPerPixel, true), 0)).toBe(true)
    }
  })
})
