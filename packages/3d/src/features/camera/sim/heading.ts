// The camera's heading as the sim keeps it: an integer in turn units, 65,536 to a full turn, 0 looking
// toward +z and growing toward +x, so the camera's forward direction is `(sin h, cos h)` in `(x, z)`. Integers only,
// so a replay stores and hashes the same in every engine. Moved here from the 3D level editor, which
// consumes it, so there is one definition. Sim-safe: no trig, no `**`.

/** Turn units in a full turn: a heading wraps here. */
export const TURN_UNITS = 65_536
/**
 * One step of the player's camera turn: 8,192 units, 45° (Q and R). A tick turns one step or none,
 * so the camera is only ever on one of eight headings, bar a zone's authored angle.
 */
export const MAX_CAMERA_TURN = 8_192
const DEGREES_PER_UNIT = 360 / TURN_UNITS

/** A heading in whole units inside one turn; a fraction is rounded to the nearest unit. Never `-0`. */
export function wrapHeading(units: number): number {
  return ((Math.round(units) % TURN_UNITS) + TURN_UNITS) % TURN_UNITS
}

/** `units` turned by `by` and wrapped. */
export const turnHeading = (units: number, by: number): number => wrapHeading(units + by)

/** The direction of a tick's turn: −1, 0 or 1. Only the sign counts; the size of a drag does not. Never `-0`. */
export const turnDirection = (units: number): number => Math.sign(units) + 0

/**
 * `units` turned one 45° step in `direction` (−1 or 1): to the next of the eight headings that way. A heading off those
 * lines (a zone's authored `yawDeg`) goes to the nearest line in that direction, not past it. 0 changes nothing.
 */
export function stepHeading(units: number, direction: number): number {
  const heading = wrapHeading(units)
  if (direction > 0) return wrapHeading((Math.floor(heading / MAX_CAMERA_TURN) + 1) * MAX_CAMERA_TURN)
  if (direction < 0) return wrapHeading((Math.ceil(heading / MAX_CAMERA_TURN) - 1) * MAX_CAMERA_TURN)
  return heading
}

/** The nearest heading to `deg` degrees, in any turn (a view's `yawDeg`). */
export const degToHeading = (deg: number): number => wrapHeading(deg / DEGREES_PER_UNIT)

/** A heading in degrees inside one turn, exactly: the angle the renderer shows. */
export const headingDegrees = (units: number): number => wrapHeading(units) * DEGREES_PER_UNIT
