// The follow camera of a room (ED3D.4c, the 3D direction spec §4.2, M3R-D9 and D11): the game's camera follows the player on a
// 24 mm lens, 25 degrees down and 5 m back from a focus a metre above the followed position, along a heading the player turns
// freely. It is the dollhouse's orbit with the game's numbers, so a room is drawn as the player sees it and the walls it cuts
// are cut by that eye. `bounds`, the easing of `lag` and lock-on framing belong to the game's renderer (M3.4): the editor
// carries `lag` as data and does not ease.
import { type Camera3D, orbitCamera } from './camera-3d'
import { degToHeading, headingToYaw, type WallsSeen, wallsSeenFrom, wrapHeading } from './heading'
import type { SectorMesh, Vec3 } from './sector-mesh'

const DEGREES = Math.PI / 180

/** A `camera-view` of a room, as the game reads it. A heading is in degrees here, as the file holds it (0 looks toward +z). */
export interface CameraViewSpec {
  readonly id?: string | undefined
  /** The heading the camera takes when the view is entered; none keeps the player's heading. */
  readonly yawDeg?: number | undefined
  /** The angle the camera looks down at, in degrees. */
  readonly tiltDeg: number
  /** Metres from the focus back along the view axis. */
  readonly distance: number
  /** Metres above the followed position that the focus sits. */
  readonly focusHeight: number
  /** Seconds of easing on the follow; the game's, not the editor's. */
  readonly lag?: number | undefined
  /** Whether the player may turn the camera in this view. */
  readonly rotate: boolean
}

/** The Owner's default view: 25 degrees down, 5 m back, a focus 1 m up, 0.18 s of lag, free rotation. */
export const CAMERA_DEFAULTS: Required<Omit<CameraViewSpec, 'id' | 'yawDeg'>> = {
  tiltDeg: 25,
  distance: 5,
  focusHeight: 1,
  lag: 0.18,
  rotate: true,
}

/** What a view is authored within (M3R-D11); the check for views refuses a number outside, the camera does not clamp it. */
export const CAMERA_RANGES: {
  readonly tiltDeg: { readonly min: number; readonly max: number }
  readonly distance: { readonly min: number; readonly max: number }
} = {
  tiltDeg: { min: 15, max: 60 },
  distance: { min: 3, max: 12 },
}

/** A view with the defaults filled in for what is not given. */
export function cameraViewSpec(given: Partial<CameraViewSpec> = {}): CameraViewSpec {
  return {
    ...given,
    tiltDeg: given.tiltDeg ?? CAMERA_DEFAULTS.tiltDeg,
    distance: given.distance ?? CAMERA_DEFAULTS.distance,
    focusHeight: given.focusHeight ?? CAMERA_DEFAULTS.focusHeight,
    lag: given.lag ?? CAMERA_DEFAULTS.lag,
    rotate: given.rotate ?? CAMERA_DEFAULTS.rotate,
  }
}

/**
 * The camera the game puts on a player at `followed` looking along `heading` (turn units): `distance` metres from the focus,
 * which is the followed position raised by `focusHeight`, tipped `tiltDeg` down, through the 24 mm lens.
 */
export function followCamera(spec: CameraViewSpec, followed: Vec3, heading: number): Camera3D {
  const focus: Vec3 = [followed[0], followed[1] + spec.focusHeight, followed[2]]
  return orbitCamera({
    target: focus,
    distance: spec.distance,
    yaw: headingToYaw(heading),
    pitch: spec.tiltDeg * DEGREES,
  })
}

export interface RoomView {
  /** The heading the camera looks along, in whole units inside one turn. */
  readonly heading: number
  readonly camera: Camera3D
  /** The walls this camera cuts or fades. */
  readonly walls: WallsSeen
  /** Whether the player may turn the camera away from this heading. */
  readonly rotate: boolean
}

/**
 * A room as the player sees it from `followed`. The camera enters at the view's `yawDeg` (none: at the heading given, else 0
 * looking toward +z) and the player may turn it away when the view allows: a heading asked for is used then. A view that
 * locks rotation holds `yawDeg` whatever heading is asked for, as the game ignores the turn (spec §4.2, D3-i).
 */
export function roomView(mesh: SectorMesh, spec: CameraViewSpec, followed: Vec3, heading?: number): RoomView {
  const entry = spec.yawDeg === undefined ? undefined : degToHeading(spec.yawDeg)
  const looking = !spec.rotate && entry !== undefined ? entry : wrapHeading(heading ?? entry ?? 0)
  const camera = followCamera(spec, followed, looking)
  return { heading: looking, camera, walls: wallsSeenFrom(mesh, camera.eye), rotate: spec.rotate }
}
