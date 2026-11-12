import type { CastMember } from '../../shared/figure/cast'
import type { View } from '../../shared/figure/figure'
import type { V3 } from '../../shared/math/math'
import type { CameraPose } from '../../shared/stage/pose'

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
    flat = Math.hypot(d[0], d[2])
  return { azimuth, pitch: Math.atan2(-d[1], flat) }
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
export const anchorOf = (cast: CastMember) => ({ x: 0.5, y: (cast.cell[1] - cast.feet) / cast.cell[1] })

/** Metres of the scene to one texel of the cell. */
export const texelOf = (cast: CastMember) => cast.metres / cast.cell[1]

/** The unit quaternion a camera at `pose`, or a quad square to it, takes: local x, y, z onto the pose's right, up and
 * −fwd (a Camera3D looks down its local −z; a Sprite3D's quad faces +z). A quad turned by this is parallel to the image
 * plane, which `facing` (a yaw to the figure's own bearing) is not: only this one lands every texel where
 * `compose` puts it under perspective. */
export function poseQuaternion(pose: Pick<CameraPose, 'right' | 'up' | 'fwd'>): {
  x: number
  y: number
  z: number
  w: number
} {
  const [m00, m10, m20] = pose.right,
    [m01, m11, m21] = pose.up,
    [m02, m12, m22] = [-pose.fwd[0], -pose.fwd[1], -pose.fwd[2]]
  const t = m00 + m11 + m22
  if (t > 0) {
    const s = 2 * Math.sqrt(t + 1)
    return { x: (m21 - m12) / s, y: (m02 - m20) / s, z: (m10 - m01) / s, w: s / 4 }
  }
  if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22)
    return { x: s / 4, y: (m01 + m10) / s, z: (m02 + m20) / s, w: (m21 - m12) / s }
  }
  if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22)
    return { x: (m01 + m10) / s, y: s / 4, z: (m12 + m21) / s, w: (m02 - m20) / s }
  }
  const s = 2 * Math.sqrt(1 + m22 - m00 - m11)
  return { x: (m02 + m20) / s, y: (m12 + m21) / s, z: s / 4, w: (m10 - m01) / s }
}

/** Throws unless the pose's principal point is the frame's centre. `StageView` draws through a `Camera3D`, whose frustum is
 * symmetric, so geometry a host adds to the same view lands where a centred pose puts it; a perspective pose with an
 * off-centre `cx`, `cy` would put the figures (placed by `compose`'s rule) and that geometry `cx − w / 2` pixels apart,
 * and per-texel depth would cut the figures in the wrong place. An orthographic pose has no principal point (`project`
 * ignores `cx`, `cy` there). */
export function checkCentred(pose: Pick<CameraPose, 'size' | 'f' | 'cx' | 'cy'>): void {
  if (pose.f === undefined) return
  const [w, h] = pose.size,
    tol = 1e-6
  if (Math.abs((pose.cx ?? w / 2) - w / 2) > tol || Math.abs((pose.cy ?? h / 2) - h / 2) > tol)
    throw new Error(
      `StageView: the pose's principal point (${pose.cx ?? w / 2}, ${pose.cy ?? h / 2}) is not the frame's centre (${w / 2}, ${h / 2}); Camera3D's frustum is symmetric, so a scene's geometry would not meet the figures`,
    )
}

/** The warning a host gets when its renderer cannot draw per-texel depth, or null when it can: the WebGL renderer (the GLSL
 * `cellDepthBit` stage) and the WebGPU renderer (its WGSL stage, through `CELL_TEMPLATE`) both can. `type` is Pixi's
 * `RendererType` (WEBGL 1, WEBGPU 2, CANVAS 4). */
export function perTexelDepthWarning(type: number): string | null {
  return type === 1 || type === 2
    ? null
    : `StageView: per-texel depth needs the WebGL or WebGPU renderer (this one is type ${type}), so figures depth-test as flat quads at their root depth: they cannot hide behind scene geometry or each other texel by texel. Init Pixi with preference: 'webgl' or 'webgpu'.`
}
