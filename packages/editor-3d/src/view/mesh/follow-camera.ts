// The follow camera of a room (ED3D.4c, the 3D direction spec §4.2, M3R-D9 and D11): the game's camera follows the player on a
// 24 mm lens, 25 degrees down and 5 m back from a focus a metre above the followed position, along a heading the player turns
// freely. It is the dollhouse's orbit with the game's numbers, so a room is drawn as the player sees it and the walls it cuts
// are cut by that eye. `bounds`, the easing of `lag` and lock-on framing belong to the game's renderer (M3.4): the editor
// carries `lag` as data and does not ease. The view is render-pixi3d's `camera-view` (one owner, M3 spec §4.2 amended
// 2026-10-30): the editor keeps no copy of its fields, defaults or ranges.

import {
  type CameraView,
  degToHeading,
  wrapHeading,
} from '@automataframework/automata-render-pixi3d/camera-view'
import { type Camera3D, orbitCamera } from './camera-3d'
import { headingToYaw, type WallsSeen, wallsSeenFrom } from './heading'
import type { SectorMesh, Vec3 } from './sector-mesh'

const DEGREES = Math.PI / 180

/**
 * The camera the game puts on a player at `followed` looking along `heading` (turn units): `distance` metres from the focus,
 * which is the followed position raised by `focusHeight`, tipped `tiltDeg` down, through the 24 mm lens.
 */
export function followCamera(spec: CameraView, followed: Vec3, heading: number): Camera3D {
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
export function roomView(mesh: SectorMesh, spec: CameraView, followed: Vec3, heading?: number): RoomView {
  const entry = spec.yawDeg === undefined ? undefined : degToHeading(spec.yawDeg)
  const looking = !spec.rotate && entry !== undefined ? entry : wrapHeading(heading ?? entry ?? 0)
  const camera = followCamera(spec, followed, looking)
  return { heading: looking, camera, walls: wallsSeenFrom(mesh, camera.eye), rotate: spec.rotate }
}
