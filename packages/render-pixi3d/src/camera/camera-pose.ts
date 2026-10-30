// The angled camera's geometry (M3 spec §4.2), kept apart from `@pixi/3d` so it is plain arithmetic to test. A heading
// of 0° looks toward +z and grows toward +x (the sim's convention, `sim/heading.ts`); the eye sits `distance` metres
// back from the focus along the view axis, tipped `tiltDeg` down. `@pixi/3d` is right-handed with +y up, so a camera
// looking along `forward` has `forward × up` on its right.
import type { CameraView } from '../sim/camera-view.schema.js'
import { fovOf, LENS_MM } from './fov.js'

export interface Vec3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

type Bounds = CameraView['bounds']

const RADIANS = Math.PI / 180
/** How far `frame(lock)` moves the focus toward the target at most: 35% of the way. */
export const LOCK_SHARE = 0.35
/** The player stays within this much of the frame's centre on each axis, in NDC: the middle third. */
const MIDDLE_THIRD = 1 / 3
const BISECTIONS = 24

/** Where the eye sits for `focus`, looking along `headingDeg`, `tiltDeg` down, `distance` metres back. */
export function eyeOf(focus: Vec3, headingDeg: number, tiltDeg: number, distance: number): Vec3 {
  const heading = headingDeg * RADIANS
  const tilt = tiltDeg * RADIANS
  const back = distance * Math.cos(tilt)
  return {
    x: focus.x - Math.sin(heading) * back,
    y: focus.y + distance * Math.sin(tilt),
    z: focus.z - Math.cos(heading) * back,
  }
}

/** `point` kept inside `bounds` (unchanged without bounds). */
export function clampToBounds(point: Vec3, bounds: Bounds): Vec3 {
  if (bounds === undefined) return point
  const clamp = (value: number, axis: 0 | 1 | 2) =>
    Math.min(bounds.max[axis], Math.max(bounds.min[axis], value))
  return { x: clamp(point.x, 0), y: clamp(point.y, 1), z: clamp(point.z, 2) }
}

/** The eases' curve: 0 before the start, 1 after the end, `3t² − 2t³` between. */
export function smoothstep(t: number): number {
  if (t <= 0) return 0
  if (t >= 1) return 1
  return t * t * (3 - 2 * t)
}

/** The signed turn in degrees from `fromDeg` to `toDeg` the shorter way round, in (−180, 180]. */
export function shorterArc(fromDeg: number, toDeg: number): number {
  const turn = (((toDeg - fromDeg) % 360) + 360) % 360
  return turn > 180 ? turn - 360 : turn
}

export const lerp3 = (a: Vec3, b: Vec3, t: number): Vec3 => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  z: a.z + (b.z - a.z) * t,
})

const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z })
const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z
const cross = (a: Vec3, b: Vec3): Vec3 => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
})
const unit = (a: Vec3): Vec3 => {
  const length = Math.hypot(a.x, a.y, a.z)
  return { x: a.x / length, y: a.y / length, z: a.z / length }
}
const UP: Vec3 = { x: 0, y: 1, z: 0 }

/**
 * `point` in normalized device coordinates for an eye looking at `look`, `fovDeg` vertical, at `aspect`, with its
 * `depth` in metres along the view axis. A point at or behind the eye (`depth <= 0`) is not on screen whatever its
 * `x` and `y` say: the division flips their signs.
 */
export function projectToNdc(
  point: Vec3,
  eye: Vec3,
  look: Vec3,
  fovDeg: number,
  aspect: number,
): { x: number; y: number; depth: number } {
  const forward = unit(sub(look, eye))
  const right = unit(cross(forward, UP))
  const up = cross(right, forward)
  const offset = sub(point, eye)
  const depth = dot(offset, forward)
  const half = Math.tan((fovDeg * RADIANS) / 2)
  return { x: dot(offset, right) / (depth * half * aspect), y: dot(offset, up) / (depth * half), depth }
}

export interface FrameInput {
  /** The followed position (the player's feet). */
  readonly player: Vec3
  /** The lock-on target's position, or none. */
  readonly lock: Vec3 | undefined
  readonly view: CameraView
  readonly headingDeg: number
  readonly aspect: number
}

/**
 * The focus for `player` in `view`, leaning toward `lock` (M3 spec §4.2 lock-on framing): up to `LOCK_SHARE` of the
 * way from the player's focus to the target's (both `focusHeight` up), clamped by the view's bounds, and cut back by
 * bisection while the player's focus would fall outside the middle third of the frame on either axis or behind the eye.
 */
export function framedFocus({ player, lock, view, headingDeg, aspect }: FrameInput): Vec3 {
  const base: Vec3 = { x: player.x, y: player.y + view.focusHeight, z: player.z }
  if (lock === undefined) return clampToBounds(base, view.bounds)
  const target: Vec3 = { x: lock.x, y: lock.y + view.focusHeight, z: lock.z }
  const fov = fovOf(LENS_MM)
  const at = (share: number): Vec3 => clampToBounds(lerp3(base, target, share), view.bounds)
  const framed = (share: number): boolean => {
    const focus = at(share)
    const ndc = projectToNdc(base, eyeOf(focus, headingDeg, view.tiltDeg, view.distance), focus, fov, aspect)
    return ndc.depth > 0 && Math.abs(ndc.x) <= MIDDLE_THIRD && Math.abs(ndc.y) <= MIDDLE_THIRD
  }
  if (framed(LOCK_SHARE)) return at(LOCK_SHARE)
  let inside = 0
  let outside = LOCK_SHARE
  for (let i = 0; i < BISECTIONS; i++) {
    const middle = (inside + outside) / 2
    if (framed(middle)) inside = middle
    else outside = middle
  }
  return at(inside)
}
