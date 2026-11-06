// The Studio stage's camera (EDS.9a; EDS-D13): an orbit about a target, and the maths the stage and its handles share:
// where a point of the figure's space shows on the picture, the ray a pixel makes, and where that ray meets the plane
// a handle is dragged in. Pure, so the handles and the drags are unit tests, and the renderer only takes the pose.
// The figure's space is its own: metres, +y up, +z the way it faces, +x its left.

export type Vec3 = readonly [number, number, number]

export interface Orbit {
  /** What the camera looks at: about the figure's chest. */
  readonly target: Vec3
  /** Radians about +y: 0 looks at the figure from the front (+z). */
  readonly yaw: number
  /** Radians above the horizon. */
  readonly pitch: number
  /** Metres from the target. */
  readonly distance: number
  /** Vertical field of view in degrees. */
  readonly fov: number
}

export const DEFAULT_ORBIT: Orbit = { target: [0, 0.9, 0], yaw: 0, pitch: 0.12, distance: 3.4, fov: 35 }

const PITCH_MIN = -0.4
const PITCH_MAX = 1.4
const RADIANS_PER_PIXEL = 0.01

const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
const scale = (a: Vec3, k: number): Vec3 => [a[0] * k, a[1] * k, a[2] * k]
const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
const unit = (a: Vec3): Vec3 => scale(a, 1 / Math.hypot(a[0], a[1], a[2]))

/** The eye and the camera's axes: right, up and forward (toward the target). */
export function basis(o: Orbit): { eye: Vec3; right: Vec3; up: Vec3; forward: Vec3 } {
  const horizontal = Math.cos(o.pitch)
  const offset: Vec3 = [
    Math.sin(o.yaw) * horizontal * o.distance,
    Math.sin(o.pitch) * o.distance,
    Math.cos(o.yaw) * horizontal * o.distance,
  ]
  const eye = add(o.target, offset)
  const forward = unit(sub(o.target, eye))
  // Looking from the front (+z) toward -z, the camera's right is +x: the figure faces the viewer, so its left is there.
  const right = unit(cross(forward, [0, 1, 0]))
  const up = cross(right, forward)
  return { eye, right, up, forward }
}

export interface Size {
  readonly w: number
  readonly h: number
}

/** Where a point of the figure's space shows, in pixels, or `undefined` for one behind the camera. */
export function project(o: Orbit, size: Size, point: Vec3): { x: number; y: number } | undefined {
  const { eye, right, up, forward } = basis(o)
  const rel = sub(point, eye)
  const depth = dot(rel, forward)
  if (depth <= 0.01) return undefined
  const focal = size.h / 2 / Math.tan((o.fov * Math.PI) / 360)
  return {
    x: size.w / 2 + (dot(rel, right) / depth) * focal,
    y: size.h / 2 - (dot(rel, up) / depth) * focal,
  }
}

export interface Ray {
  readonly origin: Vec3
  readonly direction: Vec3
}

/** The ray from the eye through a pixel. */
export function pickRay(o: Orbit, size: Size, pixel: { x: number; y: number }): Ray {
  const { eye, right, up, forward } = basis(o)
  const focal = size.h / 2 / Math.tan((o.fov * Math.PI) / 360)
  const dx = (pixel.x - size.w / 2) / focal
  const dy = (size.h / 2 - pixel.y) / focal
  return { origin: eye, direction: unit(add(add(forward, scale(right, dx)), scale(up, dy))) }
}

export interface Plane {
  readonly point: Vec3
  readonly normal: Vec3
}

/** The plane through `point` that faces the camera: where a handle is dragged. */
export function dragPlane(o: Orbit, point: Vec3): Plane {
  return { point, normal: basis(o).forward }
}

/** Where a ray meets a plane, or `undefined` when it runs parallel or the plane is behind the eye. */
export function rayAtPlane(ray: Ray, plane: Plane): Vec3 | undefined {
  const denominator = dot(ray.direction, plane.normal)
  if (Math.abs(denominator) < 1e-9) return undefined
  const t = dot(sub(plane.point, ray.origin), plane.normal) / denominator
  return t < 0 ? undefined : add(ray.origin, scale(ray.direction, t))
}

/** The orbit after a drag of the stage by `dx`, `dy` pixels. */
export function orbit(o: Orbit, drag: { dx: number; dy: number }): Orbit {
  return {
    ...o,
    yaw: o.yaw - drag.dx * RADIANS_PER_PIXEL,
    pitch: Math.min(PITCH_MAX, Math.max(PITCH_MIN, o.pitch + drag.dy * RADIANS_PER_PIXEL)),
  }
}

/** A figure's facing after a sideways drag: a drag across the stage's whole width is half a turn. */
export function turned(facing: number, dx: number, width: number): number {
  const next = facing + (dx / width) * 2 * Math.PI
  return ((next % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)
}
