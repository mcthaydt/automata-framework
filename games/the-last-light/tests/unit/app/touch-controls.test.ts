import { CameraYaw } from '@automata/3d/sim'
import type { AnalogReading } from '@automata/framework'
import { describe, expect, it } from 'vitest'
import { CAMERA_INPUT, cameraYawUnits, moveFromStick, STICK_YAW } from '#src/app/touch-controls.ts'

// On a phone the old game gave a thumb a floating stick (it appears where the thumb lands) and a swipe on the scene to turn the
// camera. The Owner, 2026-11-12: "Also cut the Q and E, let it be rotate horizontally with right stick, screen swipe, and mouse
// like normal 3D, but lock vertical rotation". So the camera turns freely (`camera-yaw`) by the right stick, a swipe and a
// mouse drag; no key turns it, and nothing tilts it.

const reading = (
  left: { x: number; y: number } = { x: 0, y: 0 },
  drag = 0,
  right = { x: 0, y: 0 },
  camera = { degPerPixel: 0.25, invert: false },
): AnalogReading => ({
  stick: (side) => (side === 'left' ? left : right),
  cameraDrag: () => drag,
  camera,
})

describe('the touch stick', () => {
  it('moves Ada the way it leans, as the keys would', () => {
    expect(moveFromStick(reading({ x: 127, y: -64 }))).toEqual({ x: 127, y: -64 })
  })

  it('adds nothing when it is centred, so the keys still walk her', () => {
    expect(moveFromStick(reading())).toEqual({})
  })
})

describe('turning the camera', () => {
  it('has no key: Q and E are gone, and no key at all turns the camera', () => {
    expect(CAMERA_INPUT.command).toBe(CameraYaw)
    const keys = Object.values(CAMERA_INPUT.profile.bindings).flatMap((binding) => binding.keys)
    expect(keys).toEqual([])
    expect(JSON.stringify(CAMERA_INPUT.profile)).not.toMatch(/KeyQ|KeyE/)
  })

  it('binds the drag, a swipe or either mouse button, the ordinary 3D drag', () => {
    const gestures = Object.values(CAMERA_INPUT.profile.bindings).flatMap((binding) => binding.gesture ?? [])
    expect(gestures).toEqual(['camera-drag'])
    expect(CAMERA_INPUT.dragMouse).toBe('either')
  })

  it('a drag to the right grabs the room and turns it with the finger; to the left the other way', () => {
    expect(cameraYawUnits(reading({ x: 0, y: 0 }, 40)).units).toBeGreaterThan(0)
    expect(cameraYawUnits(reading({ x: 0, y: 0 }, -40)).units).toBeLessThan(0)
  })

  it('the right stick looks the way it is pushed, at STICK_YAW a tick at full push, smoothly below it', () => {
    expect(cameraYawUnits(reading(undefined, 0, { x: 127, y: 0 })).units).toBe(-STICK_YAW)
    expect(cameraYawUnits(reading(undefined, 0, { x: -127, y: 0 })).units).toBe(STICK_YAW)
    expect(Math.abs(cameraYawUnits(reading(undefined, 0, { x: 40, y: 0 })).units)).toBeLessThan(STICK_YAW / 2)
  })

  it('locks the vertical: the stick’s up and down turn nothing', () => {
    expect(cameraYawUnits(reading(undefined, 0, { x: 0, y: 127 })).units).toBe(0)
    expect(cameraYawUnits(reading(undefined, 0, { x: 0, y: -127 })).units).toBe(0)
  })

  it('invert flips the stick and the drag alike', () => {
    const inverted = { degPerPixel: 0.25, invert: true }
    expect(cameraYawUnits(reading(undefined, 40, undefined, inverted)).units).toBeLessThan(0)
    expect(cameraYawUnits(reading(undefined, 0, { x: 127, y: 0 }, inverted)).units).toBe(STICK_YAW)
  })

  it('never sends more than one step’s turn, however far the finger went', () => {
    expect(Math.abs(cameraYawUnits(reading({ x: 0, y: 0 }, 100_000)).units)).toBeLessThanOrEqual(8192)
  })
})
