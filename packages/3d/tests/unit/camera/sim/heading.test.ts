// The heading's maths (M3 spec §4.2): 65,536 units to a turn, 0 looking toward +z and growing toward +x. The wrap,
// turn and degree cases moved here from the 3D level editor's `heading.test.ts` (ED3D.4c), which now consumes them.
import { describe, expect, it } from 'vitest'
import {
  degToHeading,
  headingDegrees,
  MAX_CAMERA_TURN,
  stepHeading,
  TURN_UNITS,
  turnDirection,
  turnHeading,
  wrapHeading,
} from '#src/features/camera/sim/heading.ts'

const QUARTER = TURN_UNITS / 4

describe('the turn', () => {
  it('is 65,536 units, and a tick turns one step of 8,192 of them (45°): eight steps make a turn', () => {
    expect(TURN_UNITS).toBe(65_536)
    expect(MAX_CAMERA_TURN).toBe(8_192)
    expect(TURN_UNITS / MAX_CAMERA_TURN).toBe(8)
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

  it('reads only the direction of a tick’s turn: its sign, never its size', () => {
    expect(turnDirection(1)).toBe(1)
    expect(turnDirection(20_000)).toBe(1)
    expect(turnDirection(-3)).toBe(-1)
    expect(turnDirection(0)).toBe(0)
    expect(Object.is(turnDirection(-0), 0)).toBe(true)
  })

  it('steps to the next 45° line in the turn’s direction, wrapping', () => {
    expect(stepHeading(0, 1)).toBe(8_192)
    expect(stepHeading(0, -1)).toBe(TURN_UNITS - 8_192)
    expect(stepHeading(7 * 8_192, 1)).toBe(0)
    expect(stepHeading(8_192, -1)).toBe(0)
    expect(stepHeading(3 * 8_192, 1)).toBe(4 * 8_192)
  })

  it('from an authored angle off the lines steps to the nearest line that way, not past it', () => {
    expect(stepHeading(5_000, 1)).toBe(8_192)
    expect(stepHeading(5_000, -1)).toBe(0)
    expect(stepHeading(8_193, -1)).toBe(8_192)
    expect(stepHeading(TURN_UNITS - 10, 1)).toBe(0)
  })

  it('does not step for no turn, and every heading it makes is one of the eight', () => {
    expect(stepHeading(5_000, 0)).toBe(5_000)
    let heading = 12_345
    for (let tick = 0; tick < 40; tick++) {
      heading = stepHeading(heading, tick % 3 === 0 ? -1 : 1)
      if (tick > 0) expect(heading % 8_192).toBe(0)
    }
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
