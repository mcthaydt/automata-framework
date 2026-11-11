// A 3D scene's camera as the figure builder's stage contract reads it (vendor/FigureBuilder/docs/contract.md, `CameraPose`):
// the eye and the camera's own three axes in metres, the frame in pixels, and the lens as a focal length in pixels
// (perspective) or pixels a metre (orthographic). Pure: it reads the camera and changes nothing, so it runs in Node.
import type { CameraPose, V3 } from '../../shared/figure-builder/door.ts'

/** What `poseOf` reads of a `Camera3D` (`@pixi/3d` 0.1.0-beta.2): a position, a rotation, and the lens. */
export interface CameraLike {
  readonly position: { x: number; y: number; z: number }
  readonly quaternion: { x: number; y: number; z: number; w: number }
  readonly mode: 'perspective' | 'orthographic'
  /** Vertical, degrees. */
  readonly fov: number
  /** Half the view's width, metres. */
  readonly orthographicSize: number
  readonly zoom: number
}

/** `v` turned by the unit quaternion `q`. */
function rotate(q: CameraLike['quaternion'], v: V3): V3 {
  const { x, y, z, w } = q
  const tx = 2 * (y * v[2] - z * v[1])
  const ty = 2 * (z * v[0] - x * v[2])
  const tz = 2 * (x * v[1] - y * v[0])
  return [
    v[0] + w * tx + (y * tz - z * ty),
    v[1] + w * ty + (z * tx - x * tz),
    v[2] + w * tz + (x * ty - y * tx),
  ]
}

/**
 * The camera's pose for a frame of `size` pixels. A camera looks down its local −z, so its axes are the rotation's
 * images of +x (right), +y (up) and −z (forward), and `right × up = −forward` as the contract has it. `zoom` is folded
 * in the way `Camera3D.computeProjection` does: it divides a perspective camera's field of view and multiplies an
 * orthographic camera's size, so the pose is the projection the view draws with, not the one `fov` alone would give.
 */
export function poseOf(camera: CameraLike, size: readonly [number, number]): CameraPose {
  const [w, h] = size
  const { position, quaternion: q } = camera
  const norm = Math.hypot(q.x, q.y, q.z, q.w) || 1
  const unit = { x: q.x / norm, y: q.y / norm, z: q.z / norm, w: q.w / norm }
  const axes = {
    eye: [position.x, position.y, position.z] as V3,
    right: rotate(unit, [1, 0, 0]),
    up: rotate(unit, [0, 1, 0]),
    fwd: rotate(unit, [0, 0, -1]),
    size: [w, h] as [number, number],
  }
  if (camera.mode === 'perspective') {
    const fov = (camera.fov / camera.zoom) * (Math.PI / 180)
    return { ...axes, f: h / 2 / Math.tan(fov / 2) }
  }
  return { ...axes, pixelsPerMetre: w / (2 * camera.orthographicSize * camera.zoom) }
}
