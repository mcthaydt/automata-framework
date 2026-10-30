// D3-i and M3R-D15: the heading as sim state. A `camera-turn` of N units changes the heading by exactly N (wrapping
// at 65,536) and a view with `rotate: false` ignores it; a view change latches the stick's mapping to the old
// heading until the stick is released or turns by more than 90°; the player's own turn does not latch.
import { describe, expect, it } from 'vitest'
import { cameraView } from './camera-view.schema.js'
import { TURN_UNITS } from './heading.js'
import { mapStick, Q16 } from './stick-mapper.js'
import { enterView, type HeadingState, moveDirection, START, turnCamera } from './view-latch.js'

const QUARTER = TURN_UNITS / 4
const UP = { x: 0, y: -127 } as const
const CENTRED = { x: 0, y: 0 } as const
const hall = cameraView('hall')
const north = cameraView('north', { yawDeg: 90 })
const arena = cameraView('arena', { yawDeg: 180, rotate: false })

const inHall = (heading = 0): HeadingState => ({ ...enterView(START, hall, CENTRED), heading })

describe('the start', () => {
  it('has no view, heading 0, no latch, and takes no turn until a view is entered', () => {
    expect(START).toEqual({
      view: '',
      heading: 0,
      rotate: false,
      latched: false,
      latchHeading: 0,
      latchX: 0,
      latchY: 0,
    })
    expect(turnCamera(START, 100)).toEqual(START)
  })

  it('entering the first view never latches, even with the stick held', () => {
    expect(enterView(START, north, UP)).toMatchObject({ view: 'north', heading: QUARTER, latched: false })
  })
})

describe('turnCamera', () => {
  it('changes the heading by exactly N and wraps at 65,536', () => {
    expect(turnCamera(inHall(100), 5).heading).toBe(105)
    expect(turnCamera(inHall(100), -200).heading).toBe(TURN_UNITS - 100)
    expect(turnCamera(inHall(TURN_UNITS - 1), 1).heading).toBe(0)
  })

  it('clamps a turn to ±8,192', () => {
    expect(turnCamera(inHall(0), 20_000).heading).toBe(8_192)
    expect(turnCamera(inHall(0), -20_000).heading).toBe(TURN_UNITS - 8_192)
  })

  it('is ignored in a view with rotate: false', () => {
    const fixed = enterView(inHall(0), arena, CENTRED)
    expect(turnCamera(fixed, 1_000)).toEqual(fixed)
  })
})

describe('enterView', () => {
  it('sets the heading to the view’s yawDeg in the same tick, and keeps the player’s heading when it has none', () => {
    expect(enterView(inHall(500), north, CENTRED)).toMatchObject({ view: 'north', heading: QUARTER })
    expect(enterView(enterView(inHall(500), north, CENTRED), hall, CENTRED)).toMatchObject({
      view: 'hall',
      heading: QUARTER,
    })
  })

  it('takes the view’s rotate', () => {
    expect(enterView(inHall(), arena, CENTRED).rotate).toBe(false)
    expect(enterView(enterView(inHall(), arena, CENTRED), hall, CENTRED).rotate).toBe(true)
  })

  it('does nothing when the view is the one the player is in', () => {
    const state = inHall(123)
    expect(enterView(state, hall, UP)).toBe(state)
  })

  it('with the stick centred, does not latch', () => {
    expect(enterView(inHall(0), north, CENTRED).latched).toBe(false)
  })
})

describe('the latch (M3R-D15)', () => {
  const crossed = enterView(inHall(0), north, UP)

  it('a view change with the stick held latches the mapping to the old heading', () => {
    expect(crossed).toMatchObject({
      heading: QUARTER,
      latched: true,
      latchHeading: 0,
      latchX: 0,
      latchY: -127,
    })
    const { state, direction } = moveDirection(crossed, UP)
    expect(state.latched).toBe(true)
    // Still walking toward +z, the old forward, not the new heading's +x.
    expect(direction).toEqual({ x: 0, z: Q16 })
  })

  it('holds while the stick turns by up to 90°, exactly 90° included', () => {
    for (const stick of [
      { x: 90, y: -90 },
      { x: 127, y: 0 },
      { x: -127, y: 0 },
    ]) {
      const { state, direction } = moveDirection(crossed, stick)
      expect(state.latched, JSON.stringify(stick)).toBe(true)
      expect(direction).toEqual(mapStick(stick, 0))
    }
  })

  it('lets go when the stick turns by more than 90°, mapping through the new heading from that tick', () => {
    const stick = { x: 127, y: 1 }
    const { state, direction } = moveDirection(crossed, stick)
    expect(state.latched).toBe(false)
    expect(direction).toEqual(mapStick(stick, QUARTER))
  })

  it('lets go when the stick is released', () => {
    const released = moveDirection(crossed, CENTRED)
    expect(released.state.latched).toBe(false)
    expect(released.direction).toEqual({ x: 0, z: 0 })
    expect(moveDirection(released.state, UP).direction).toEqual(mapStick(UP, QUARTER))
  })

  it('keeps the first heading through a second view change while latched', () => {
    const twice = enterView(crossed, arena, UP)
    expect(twice).toMatchObject({ view: 'arena', heading: TURN_UNITS / 2, latched: true, latchHeading: 0 })
  })

  it('a player’s own turn never latches, and lets go of a latch: they asked for the new heading', () => {
    const turned = turnCamera(inHall(0), 1_000)
    expect(turned.latched).toBe(false)
    const unlatched = turnCamera(crossed, 1_000)
    expect(unlatched).toMatchObject({ heading: QUARTER + 1_000, latched: false })
    expect(moveDirection(unlatched, UP).direction).toEqual(mapStick(UP, QUARTER + 1_000))
  })

  it('a turn of 0 leaves a latch as it is', () => {
    expect(turnCamera(crossed, 0)).toBe(crossed)
  })
})
