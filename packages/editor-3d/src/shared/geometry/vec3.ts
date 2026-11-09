// The little vector arithmetic the camera and the 3D picking share (ED3D.4 steps 7 and 8): triples in, triples out, no
// classes, so a camera or a ray is plain data.
import type { Vec3 } from './sector-mesh'

export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]

export const sub = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]

export const scale = (a: Vec3, factor: number): Vec3 => [a[0] * factor, a[1] * factor, a[2] * factor]

export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]

/** By the right-hand rule: `x` across `y` is `z`. */
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]

export const length = (a: Vec3): number => Math.hypot(a[0], a[1], a[2])

/** The vector with length 1 in the same direction; the zero vector, which has none, stays the zero vector. */
export function unit(a: Vec3): Vec3 {
  const size = length(a)
  return size === 0 ? [0, 0, 0] : [a[0] / size, a[1] / size, a[2] / size]
}
