// What the views of a level take from its profile (ED3D spec §4.1 and D8): the unit, Walk's eye height and field of
// view, and the data step. Below the views, so a profile and the camera read the same numbers.

const DEGREES = Math.PI / 180

/** Walk's field of view (ED3D-D8), vertical, in radians, and its eye height in metres. */
export const WALK_FOV: number = 69 * DEGREES
export const WALK_EYE_HEIGHT = 1.6

export interface LevelHints {
  readonly unit: 'm'
  /** Metres above the floor. */
  readonly eyeHeight: number
  /** Walk's vertical field of view, in radians, as `Camera3D.fov` is. */
  readonly fov: number
  /** The step a free point is rounded to, in metres. */
  readonly snap: number
}

/** Both profiles' hints: ED3D-D8's eye and lens, and the 5 cm snap of the Last Light editor's plan. */
export const SECTOR_HINTS: LevelHints = { unit: 'm', eyeHeight: WALK_EYE_HEIGHT, fov: WALK_FOV, snap: 0.05 }
