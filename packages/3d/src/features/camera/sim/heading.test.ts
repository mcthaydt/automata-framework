// The heading's maths (M3 spec §4.2): 65,536 units to a turn, 0 looking toward +z and growing toward +x. The wrap,
// turn and degree cases moved here from the 3D level editor's `heading.test.ts` (ED3D.4c), which now consumes them.
import { describe, expect, it } from 'vitest'
import {
  clampTurn,
  degToHeading,
  headingDegrees,
  MAX_CAMERA_TURN,
  TURN_UNITS,
  turnHeading,
  wrapHeading,
} from './heading.ts'

const QUARTER = TURN_UNITS / 4

describe('the turn', () => {
  it('is 65,536 units, and a tick turns at most 8,192 of them (45°)', () => {
    expect(TURN_UNITS).toBe(65_536)
    expect(MAX_CAMERA_TURN).toBe(8_192)
  })

  it('wraps a heading into one turn, from either side, and rounds a fraction to a whole unit', () => {
    expect(wrapHeading(0)).toBe(0)
    expect(wrapHeading(TURN_UNITS)).toBe(0)
    expect(wrapHeading(TURN_UNITS - 1)).toBe(TURN_UNITS - 1)
    expect(wrapHeading(-1)).toBe(TURN_UNITS - 1)
    expect(wrapHeading(70_000)).toBe(4_464)
    expect(wrapHeading(-3 * TURN_UNITS - 5)).toBe(TURN_UNITS - 5)
    expect(wrapHeading(1.4)).toBe(1)
    expect(wrapHeading(1.5)).toBe(2)
    // A fraction that rounds up to a whole turn is the start of the next, and a small negative one is zero, not minus zero.
    expect(wrapHeading(TURN_UNITS - 0.4)).toBe(0)
    expect(Object.is(wrapHeading(-0.4), 0)).toBe(true)
  })

  it('turns a heading by some units and wraps it', () => {
    expect(turnHeading(100, 50)).toBe(150)
    expect(turnHeading(65_000, 1_000)).toBe(464)
    expect(turnHeading(100, -200)).toBe(TURN_UNITS - 100)
    expect(turnHeading(5, 3 * TURN_UNITS)).toBe(5)
  })

  it('clamps a tick’s turn to ±8,192 and keeps it whole', () => {
    expect(clampTurn(100)).toBe(100)
    expect(clampTurn(8_192)).toBe(8_192)
    expect(clampTurn(8_193)).toBe(8_192)
    expect(clampTurn(-1_000_000)).toBe(-8_192)
    expect(Object.is(clampTurn(-0), 0)).toBe(true)
  })
})

describe('degrees', () => {
  it('reads a yawDeg as the nearest unit of a turn, in any turn', () => {
    expect(degToHeading(0)).toBe(0)
    expect(degToHeading(90)).toBe(QUARTER)
    expect(degToHeading(360)).toBe(0)
    expect(degToHeading(-90)).toBe(3 * QUARTER)
    expect(degToHeading(450)).toBe(QUARTER)
    expect(degToHeading(0.0055)).toBe(1)
    expect(degToHeading(359.9945)).toBe(TURN_UNITS - 1)
  })

  it('gives a heading’s degrees exactly, inside one turn, for the camera to show', () => {
    expect(headingDegrees(0)).toBe(0)
    expect(headingDegrees(QUARTER)).toBe(90)
    expect(headingDegrees(1)).toBe(360 / 65_536)
    expect(headingDegrees(-QUARTER)).toBe(270)
    for (let units = 0; units < TURN_UNITS; units += 7)
      expect(degToHeading(headingDegrees(units))).toBe(units)
  })
})
