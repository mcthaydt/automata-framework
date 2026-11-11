// The camera of a 3D scene as a painted figure sees it, and how its cell's quad stands in the scene: the geometry the
// view (figure-sprite.ts) needs, free of Pixi so it is tested in Node.
import type { CastMember, View } from '../../shared/figure-builder/door.ts'

/** A point in the scene, in metres (x right, y up). */
export type Point3 = readonly [number, number, number]

/**
 * The camera as a figure sees it (the builder's `View`): its bearing round the figure (0 when it stands on the figure's
 * +z, as the review sheets' camera does) and the pitch it looks down at. `eye` is the camera's position and `target` the
 * point it looks at.
 */
export function viewFrom(eye: Point3, target: Point3, at: Point3): View {
  const azimuth = Math.atan2(eye[0] - at[0], eye[2] - at[2])
  const d = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]] as const
  return { azimuth, pitch: Math.atan2(-d[1], Math.hypot(d[0], d[2])) }
}

/** The quaternion that turns a quad facing +z to face a camera at `azimuth` round it, looking down at `pitch`: the
 * pitch about x (its top leaning away), then the yaw about y. */
export function facing(azimuth: number, pitch: number): { x: number; y: number; z: number; w: number } {
  const cy = Math.cos(azimuth / 2),
    sy = Math.sin(azimuth / 2),
    cx = Math.cos(-pitch / 2),
    sx = Math.sin(-pitch / 2)
  return { x: cy * sx, y: sy * cx, z: -sy * sx, w: cy * cx }
}

/** Where on the cell the figure's root sits, as a sprite anchor (x across, y down from the top). */
export const anchorOf = (cast: CastMember): { x: number; y: number } => ({
  x: 0.5,
  y: (cast.cell[1] - cast.feet) / cast.cell[1],
})

/** Metres of the scene to one texel of the cell. */
export const texelOf = (cast: CastMember): number => cast.metres / cast.cell[1]

/** Where a camera stands and the point it looks at: its position, and one metre along its view (its local −z). */
export function eyeOf(camera: {
  readonly position: { x: number; y: number; z: number }
  readonly quaternion: { x: number; y: number; z: number; w: number }
}): { eye: Point3; target: Point3 } {
  const { x, y, z, w } = camera.quaternion,
    p = camera.position
  const fx = -2 * (x * z + w * y),
    fy = -2 * (y * z - w * x),
    fz = -(1 - 2 * (x * x + y * y))
  return { eye: [p.x, p.y, p.z], target: [p.x + fx, p.y + fy, p.z + fz] }
}
