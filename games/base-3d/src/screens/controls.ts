// The analog half of the controls (GAME-3D.1h, DESIGN.md §14): what the left stick, the right stick and the camera
// drag add to the keys' `move` and `camera-turn`, and the touch layout's five buttons. Presentation only: the sim
// sees integers (`move` ±127, `camera-turn` ±8,192), never an input device.
import type { AnalogReading, InputMap } from '@mcthaydt/automata-game'
import { STICK_MAX } from '@mcthaydt/automata-render-pixi3d/sim'
import { MAX_TURN_UNITS_PER_STEP, turnUnitsFromPixels } from '@mcthaydt/automata-runtime'
import { TICK_HZ } from '../constants/index.ts'

/** The right stick turns the camera at 180° a second (§14.3, M4-D16): 65,536 × 180 / 360 / 60 ≈ 546 units a tick. */
export const STICK_TURN_UNITS = Math.round((65_536 * 180) / 360 / TICK_HZ)

/** The left stick as `move`; centred, it adds nothing, so WASD (the held payload) still moves. */
export function moveFromStick(reading: AnalogReading): { x?: number; y?: number } {
  const { x, y } = reading.stick('left')
  return x !== 0 || y !== 0 ? { x, y } : {}
}

/**
 * The camera turn of a tick: the keys' units (`held`), plus the right stick's, plus the drag's (the player's camera
 * speed and invert), clamped to ±`MAX_TURN_UNITS_PER_STEP` (G3-F5). A non-finite sum is `NaN`, which the command's
 * schema refuses, so it never reaches the sim.
 */
export function cameraTurnUnits(reading: AnalogReading, held: { readonly units: number }): { units: number } {
  const stick = Math.round((reading.stick('right').x / STICK_MAX) * STICK_TURN_UNITS)
  const drag = turnUnitsFromPixels(reading.cameraDrag(), reading.camera.degPerPixel, reading.camera.invert)
  const units = held.units + stick + drag
  return { units: Math.max(-MAX_TURN_UNITS_PER_STEP, Math.min(MAX_TURN_UNITS_PER_STEP, units)) }
}

/**
 * `map` with its touch buttons in the `end` group under the game's words: the five buttons of §14.4, each named by
 * its first key (`names`, by `KeyboardEvent.code`).
 */
export function endGroup(map: InputMap, names: Readonly<Record<string, string>>): InputMap {
  return {
    ...map,
    touchButtons: map.touchButtons.map((button) => ({
      ...button,
      side: 'end',
      label: names[button.keys[0] as string] ?? button.label,
    })),
  }
}
