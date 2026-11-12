import type { AnalogReading } from '@automata/framework'
import { MAX_TURN_UNITS_PER_STEP, turnUnitsFromPixels } from '@automata/framework'

// What a thumb does on a phone, as the old game had it: a floating stick that appears where the thumb lands moves Ada, and a swipe on
// the scene turns the camera. Neither is a row of keys. The sim sees integers (`move` +-127, `camera-turn` +-8,192), never a device.

/** The left stick as `move`; centred, it adds nothing, so the keys (the held payload) still walk her. */
export function moveFromStick(reading: AnalogReading): { x?: number; y?: number } {
  const { x, y } = reading.stick('left')
  return x !== 0 || y !== 0 ? { x, y } : {}
}

/**
 * The camera turn of a tick: the keys' units (`held`) plus the swipe's, by the player's camera speed and invert, clamped to one
 * step. A non-finite sum is `NaN`, which the command's schema refuses, so it never reaches the sim.
 */
export function cameraTurnUnits(reading: AnalogReading, held: { readonly units: number }): { units: number } {
  const drag = turnUnitsFromPixels(reading.cameraDrag(), reading.camera.degPerPixel, reading.camera.invert)
  return { units: Math.max(-MAX_TURN_UNITS_PER_STEP, Math.min(MAX_TURN_UNITS_PER_STEP, held.units + drag)) }
}
