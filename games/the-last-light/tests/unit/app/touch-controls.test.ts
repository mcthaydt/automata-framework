import type { AnalogReading } from '@automata/framework'
import { describe, expect, it } from 'vitest'
import { cameraTurnUnits, moveFromStick } from '#src/app/touch-controls.ts'

// On a phone the old game gave a thumb a floating stick (it appears where the thumb lands) and a swipe on the scene to turn the
// camera, and a tap to walk to a thing: no row of keys. These are what the stick and the swipe add to the keys' payload.

const reading = (
  left: { x: number; y: number } = { x: 0, y: 0 },
  drag = 0,
  right = { x: 0, y: 0 },
): AnalogReading => ({
  stick: (side) => (side === 'left' ? left : right),
  cameraDrag: () => drag,
  camera: { degPerPixel: 0.3, invert: false },
})

describe('the touch stick', () => {
  it('moves Ada the way it leans, as the keys would', () => {
    expect(moveFromStick(reading({ x: 127, y: -64 }))).toEqual({ x: 127, y: -64 })
  })

  it('adds nothing when it is centred, so the keys still walk her', () => {
    expect(moveFromStick(reading())).toEqual({})
  })
})

describe('the swipe that turns the camera', () => {
  it('adds its turn to the keys’, by the player’s camera speed', () => {
    expect(cameraTurnUnits(reading({ x: 0, y: 0 }, 40), { units: 0 }).units).toBeGreaterThan(0)
    expect(cameraTurnUnits(reading({ x: 0, y: 0 }, -40), { units: 0 }).units).toBeLessThan(0)
  })

  it('keeps the keys’ turn when there is no swipe', () => {
    expect(cameraTurnUnits(reading(), { units: 364 })).toEqual({ units: 364 })
  })

  it('never sends more than one step’s turn, however far the finger went', () => {
    expect(
      Math.abs(cameraTurnUnits(reading({ x: 0, y: 0 }, 100_000), { units: 0 }).units),
    ).toBeLessThanOrEqual(8192)
  })
})
