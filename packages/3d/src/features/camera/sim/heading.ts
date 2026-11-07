// The camera's heading as the sim keeps it (M3 spec §4.2): an integer in turn units, 65,536 to a full turn, 0 looking
// toward +z and growing toward +x, so the camera's forward direction is `(sin h, cos h)` in `(x, z)`. Integers only,
// so a replay stores and hashes the same in every engine. Moved here from the 3D level editor (ED3D.4c), which
// consumes it, so there is one definition. Sim-safe: no trig, no `**`.

/** Turn units in a full turn: a heading wraps here. */
export const TURN_UNITS = 65_536
/** The most one tick's `camera-turn` turns the heading either way: 8,192 units, 45°. */
export const MAX_CAMERA_TURN = 8_192
const DEGREES_PER_UNIT = 360 / TURN_UNITS

/** A heading in whole units inside one turn; a fraction is rounded to the nearest unit. Never `-0`. */
export function wrapHeading(units: number): number {
  return ((Math.round(units) % TURN_UNITS) + TURN_UNITS) % TURN_UNITS
}

/** `units` turned by `by` and wrapped. */
export const turnHeading = (units: number, by: number): number => wrapHeading(units + by)

/** A tick's turn, clamped to ±`MAX_CAMERA_TURN` and rounded to a whole unit. Never `-0`. */
export const clampTurn = (units: number): number =>
  Math.max(-MAX_CAMERA_TURN, Math.min(MAX_CAMERA_TURN, Math.round(units))) + 0

/** The nearest heading to `deg` degrees, in any turn (a view's `yawDeg`). */
export const degToHeading = (deg: number): number => wrapHeading(deg / DEGREES_PER_UNIT)

/** A heading in degrees inside one turn, exactly: the angle the renderer shows. */
export const headingDegrees = (units: number): number => wrapHeading(units) * DEGREES_PER_UNIT
