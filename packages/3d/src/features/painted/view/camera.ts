import type { CastMember } from '../figure/cast.ts'
import type { View } from '../figure/figure.ts'
import type { V3 } from '../lib/math.ts'

/**
 * The camera of a 3D scene as a painted figure sees it, and how its cell's quad stands in the scene: the geometry the
 * Pixi 3D view (figure-sprite.ts) needs, kept free of Pixi so it is tested in Node.
 */

/** The camera as a figure sees it (figure.ts View): its bearing round the figure (0 when it stands on the figure's
 * +z, as the sheets' camera does) and the pitch it looks down at. `eye` is the camera's position and `target` the point
 * it looks at, both in the scene's metres (x right, y up). */
export function viewFrom(eye: V3, target: V3, at: V3): View {
  const azimuth = Math.atan2(eye[0] - at[0], eye[2] - at[2])
  const d = [target[0] - eye[0], target[1] - eye[1], target[2] - eye[2]],
    flat = Math.hypot(d[0]!, d[2]!)
  return { azimuth, pitch: Math.atan2(-d[1]!, flat) }
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
