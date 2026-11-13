// Camera turn units: the sim keeps the camera's heading as an integer, 65,536 units
// to a full turn, and takes at most ±8,192 (45°) a step, so a replay stores integers only and matches in every
// engine. The input layer turns a drag's pixels and a right stick's push into units here, outside the sim; the sim
// never calls this.

import { CAMERA_TURN_SPEED, type CameraSettings } from './camera-settings.schema.ts'

/** Turn units in a full turn: the heading wraps here. */
export const TURN_UNITS_PER_TURN = 65_536
/** The most one step's `camera-turn` may carry either way: 45°. */
export const MAX_TURN_UNITS_PER_STEP = 8_192

/**
 * `dxPx` dragged at `degPerPixel` as whole turn units: positive for a drag to the right (which way that turns the
 * heading is the game's convention), negated when `invert`, clamped to ±`MAX_TURN_UNITS_PER_STEP`. Halves round away
 * from zero, so a drag left and the same drag right are the same size. A non-finite input or a `degPerPixel` that is
 * not positive gives 0, and the result is never −0.
 */
export function turnUnitsFromPixels(dxPx: number, degPerPixel: number, invert: boolean): number {
  if (!Number.isFinite(dxPx) || !Number.isFinite(degPerPixel) || degPerPixel <= 0) return 0
  const units = (dxPx * degPerPixel * TURN_UNITS_PER_TURN) / 360
  const size = Math.min(MAX_TURN_UNITS_PER_STEP, Math.round(Math.abs(units)))
  if (size === 0) return 0
  return units < 0 !== invert ? -size : size
}

/** A stick axis's full push, as `Input.stick()` quantizes it. */
const STICK_FULL = 127

/**
 * A right stick's turn for one tick, as whole turn units: `x` (−127..127, through the pad's dead zone already) over a full
 * push of `unitsPerTick`, scaled by the player's turn speed against its default (so the one "Camera turn speed" row
 * tunes the stick and the drag alike), negated when `invert`, clamped to ±`MAX_TURN_UNITS_PER_STEP`. Positive for a push
 * to the right; which way that turns the heading is the game's convention. A non-finite input gives 0, never −0.
 */
export function turnUnitsFromStick(x: number, unitsPerTick: number, camera: CameraSettings): number {
  if (!Number.isFinite(x) || !Number.isFinite(unitsPerTick)) return 0
  const units = (x / STICK_FULL) * unitsPerTick * (camera.degPerPixel / CAMERA_TURN_SPEED.default)
  const size = Math.min(MAX_TURN_UNITS_PER_STEP, Math.round(Math.abs(units)))
  if (size === 0) return 0
  return units < 0 !== camera.invert ? -size : size
}
