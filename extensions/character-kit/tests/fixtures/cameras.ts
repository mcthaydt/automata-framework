// Cameras for the placement tests, as `Camera3D` holds them (a position and a quaternion; it looks down its local −z), made
// from a yaw and a pitch by plain quaternion products, so a test of `poseOf` does not lean on the code it tests.
import type { CameraLike } from '#src/features/painted/pose.ts'

type Quaternion = { x: number; y: number; z: number; w: number }
const DEG = Math.PI / 180

/** Yaw about +y (a camera on +x of what it looks at has yaw +90°), then pitch down about the camera's own x. */
export function turned(yawDeg: number, pitchDownDeg: number): Quaternion {
  const yaw = (yawDeg * DEG) / 2
  const pitch = (-pitchDownDeg * DEG) / 2
  const qy = { x: 0, y: Math.sin(yaw), z: 0, w: Math.cos(yaw) }
  const qx = { x: Math.sin(pitch), y: 0, z: 0, w: Math.cos(pitch) }
  return {
    x: qy.w * qx.x + qy.x * qx.w + qy.y * qx.z - qy.z * qx.y,
    y: qy.w * qx.y - qy.x * qx.z + qy.y * qx.w + qy.z * qx.x,
    z: qy.w * qx.z + qy.x * qx.y - qy.y * qx.x + qy.z * qx.w,
    w: qy.w * qx.w - qy.x * qx.x - qy.y * qx.y - qy.z * qx.z,
  }
}

/** A perspective camera with a vertical field of view of `fov` degrees. */
export function perspectiveCamera(
  position: readonly [number, number, number],
  yawDeg: number,
  pitchDownDeg: number,
  fov = 53.13010235415598,
  zoom = 1,
): CameraLike {
  return {
    position: { x: position[0], y: position[1], z: position[2] },
    quaternion: turned(yawDeg, pitchDownDeg),
    mode: 'perspective',
    fov,
    orthographicSize: 5,
    zoom,
  }
}

/** An orthographic camera whose view is `halfWidth` metres either side of its axis. */
export function orthographicCamera(
  position: readonly [number, number, number],
  yawDeg: number,
  pitchDownDeg: number,
  halfWidth: number,
  zoom = 1,
): CameraLike {
  return {
    position: { x: position[0], y: position[1], z: position[2] },
    quaternion: turned(yawDeg, pitchDownDeg),
    mode: 'orthographic',
    fov: 60,
    orthographicSize: halfWidth,
    zoom,
  }
}

/** The follow view of `characterkit-painted`: `back` metres from a focus `focusHeight` above `focus`, `pitchDownDeg` down. */
export function followCamera(
  focus: readonly [number, number, number],
  back = 5,
  pitchDownDeg = 25,
  focusHeight = 1,
  fov = 53.13010235415598,
): CameraLike {
  const pitch = pitchDownDeg * DEG
  return perspectiveCamera(
    [focus[0], focus[1] + focusHeight + back * Math.sin(pitch), focus[2] + back * Math.cos(pitch)],
    0,
    pitchDownDeg,
    fov,
  )
}
