import { STICK_MAX } from '@automata/3d/sim'
import type { AnalogReading, InputMap } from '@automata/framework'
import { MAX_TURN_UNITS_PER_STEP, turnUnitsFromPixels } from '@automata/framework'
import { TICK_HZ } from '../shared/constants.ts'

// The analog half of the controls: what the touch stick and the camera drag add to the keys' move and camera-turn.
// Presentation only: the sim sees whole numbers, never an input device.

/** The right stick turns the camera at 180 degrees a second: 65,536 units a turn, so about 546 units a tick. */
const STICK_TURN_UNITS = Math.round((65_536 * 180) / 360 / TICK_HZ)

/** `map` with its touch buttons named in the game's words (`names`, by KeyboardEvent.code of the button's first key). */
export function labelled(map: InputMap, names: Readonly<Record<string, string>>): InputMap {
  return {
    ...map,
    touchButtons: map.touchButtons.map((button) => ({
      ...button,
      label: names[button.keys[0] as string] ?? button.label,
    })),
  }
}

/** The left stick as a move; centred, it adds nothing, so the keys (the held payload) still move Wick. */
export function moveFromStick(reading: AnalogReading): { x?: number; y?: number } {
  const { x, y } = reading.stick('left')
  return x !== 0 || y !== 0 ? { x, y } : {}
}

/**
 * The camera turn of a tick: the keys' units, plus the right stick's, plus a drag's (the player's camera speed and
 * invert settings), held to what one step may turn.
 */
export function cameraTurnUnits(reading: AnalogReading, held: { readonly units: number }): { units: number } {
  const stick = Math.round((reading.stick('right').x / STICK_MAX) * STICK_TURN_UNITS)
  const drag = turnUnitsFromPixels(reading.cameraDrag(), reading.camera.degPerPixel, reading.camera.invert)
  const units = held.units + stick + drag
  return { units: Math.max(-MAX_TURN_UNITS_PER_STEP, Math.min(MAX_TURN_UNITS_PER_STEP, units)) }
}
