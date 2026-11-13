import { CameraYaw } from '@automata/3d/sim'
import type { AnalogReading } from '@automata/framework'
import { keys, MAX_TURN_UNITS_PER_STEP, turnUnitsFromPixels, turnUnitsFromStick } from '@automata/framework'
import { TICK_HZ } from '../shared/constants.ts'

// What a thumb, a pad and a mouse do beyond the keys: a floating stick that appears where the thumb lands moves Ada, and the
// camera turns horizontally only, as an ordinary third-person game's does (the Owner, 2026-11-12: "Also cut the Q and E, let
// it be rotate horizontally with right stick, screen swipe, and mouse like normal 3D, but lock vertical rotation"). The sim sees
// integers (`move` +-127, `camera-yaw` +-8,192 turn units), never a device; the tilt is the view's and no input reaches it.

/** The right stick at full push turns the camera 150 degrees a second: 65,536 units a turn, about 455 a tick. */
export const STICK_YAW = Math.round((65_536 * 150) / 360 / TICK_HZ)

/** The left stick as `move`; centred, it adds nothing, so the keys (the held payload) still walk her. */
export function moveFromStick(reading: AnalogReading): { x?: number; y?: number } {
  const { x, y } = reading.stick('left')
  return x !== 0 || y !== 0 ? { x, y } : {}
}

/**
 * The camera's free turn this tick, by the player's camera speed and invert, clamped to one step. A drag (a finger on the
 * scene, or the mouse with either button) grabs the room: dragged right, the room turns right with it, as a drag turns a 3D
 * view in a browser. The right stick looks the way it is pushed, as a pad's camera stick does: pushed right, the view turns
 * right. Only the stick's x is read, so the vertical is locked. A non-finite sum is `NaN`, which the command's schema refuses.
 */
export function cameraYawUnits(reading: AnalogReading): { units: number } {
  const drag = turnUnitsFromPixels(reading.cameraDrag(), reading.camera.degPerPixel, reading.camera.invert)
  // The heading grows toward the camera's left (`mapStick`), so looking right is a negative turn.
  const stick = -turnUnitsFromStick(reading.stick('right').x, STICK_YAW, reading.camera)
  const units = drag + stick
  return { units: Math.max(-MAX_TURN_UNITS_PER_STEP, Math.min(MAX_TURN_UNITS_PER_STEP, units)) + 0 }
}

/**
 * The camera's input: no key (Q and E are gone), the right stick, and the drag surface, which a finger anywhere off the
 * controls or the mouse with either button drags (the scene takes no click: what Ada can use is a button on the HUD, above the
 * surface, so a turn never steals a tap on one).
 */
export const CAMERA_INPUT = keys(
  CameraYaw,
  {},
  { idle: { units: 0 }, touch: false, analog: { drag: true, mouseDrag: 'either', read: cameraYawUnits } },
)
