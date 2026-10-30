// Small math for the procedural figures: vectors, quaternions and affine matrices as plain arrays, so the rig
// runs the same in Node (tests, content checks) and in the browser.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/math.ts at a1f7246. Changed for AF's
// strict compiler settings only: matrices are fixed tuples (`M` 12 numbers, `R3` 9) so reading an element is a
// number, and the exported arrow functions carry their return types. The formulas and their order are the
// source's, and the tests pin its numbers.

export type V3 = [number, number, number]
/** A unit quaternion, [x, y, z, w]. */
export type Q = [number, number, number, number]
/** A row-major 3x3 rotation. */
export type R3 = [number, number, number, number, number, number, number, number, number]
/** An affine transform, row-major 3x3 rotation then the translation: [r00 r01 r02 r10 r11 r12 r20 r21 r22 tx ty tz]. */
export type M = [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
]

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]]
export const scale = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k]
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
export const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
]
export const length = (a: V3): number => Math.hypot(a[0], a[1], a[2])
export const normalize = (a: V3): V3 => {
  const l = length(a) || 1
  return [a[0] / l, a[1] / l, a[2] / l]
}
export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k
export const lerp3 = (a: V3, b: V3, k: number): V3 => [
  lerp(a[0], b[0], k),
  lerp(a[1], b[1], k),
  lerp(a[2], b[2], k),
]
export const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v))
export const smooth = (k: number): number => {
  const t = clamp(k, 0, 1)
  return t * t * (3 - 2 * t)
}

export const IDENTITY_Q: Q = [0, 0, 0, 1]
export function axisAngle(axis: V3, angle: number): Q {
  const [x, y, z] = normalize(axis)
  const s = Math.sin(angle / 2)
  return [x * s, y * s, z * s, Math.cos(angle / 2)]
}
export function qmul(a: Q, b: Q): Q {
  return [
    a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1],
    a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
    a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3],
    a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2],
  ]
}
/** Pitch about x, then yaw about y, then roll about z, applied as yaw · pitch · roll (a head or a limb's swing). */
export function euler(pitch: number, yaw: number, roll: number): Q {
  return qmul(qmul(axisAngle([0, 1, 0], yaw), axisAngle([1, 0, 0], pitch)), axisAngle([0, 0, 1], roll))
}
export function qconj(q: Q): Q {
  return [-q[0], -q[1], -q[2], q[3]]
}
/** A rotation matrix (row-major 3x3) from a quaternion. */
export function qmat(q: Q): R3 {
  const [x, y, z, w] = q
  return [
    1 - 2 * (y * y + z * z),
    2 * (x * y - z * w),
    2 * (x * z + y * w),
    2 * (x * y + z * w),
    1 - 2 * (x * x + z * z),
    2 * (y * z - x * w),
    2 * (x * z - y * w),
    2 * (y * z + x * w),
    1 - 2 * (x * x + y * y),
  ]
}
/** A quaternion from a rotation matrix (row-major 3x3). */
export function matq(m: R3): Q {
  const t = m[0] + m[4] + m[8]
  let q: Q
  if (t > 0) {
    const s = Math.sqrt(t + 1) * 2
    q = [(m[7] - m[5]) / s, (m[2] - m[6]) / s, (m[3] - m[1]) / s, s / 4]
  } else if (m[0] > m[4] && m[0] > m[8]) {
    const s = Math.sqrt(1 + m[0] - m[4] - m[8]) * 2
    q = [s / 4, (m[1] + m[3]) / s, (m[2] + m[6]) / s, (m[7] - m[5]) / s]
  } else if (m[4] > m[8]) {
    const s = Math.sqrt(1 + m[4] - m[0] - m[8]) * 2
    q = [(m[1] + m[3]) / s, s / 4, (m[5] + m[7]) / s, (m[2] - m[6]) / s]
  } else {
    const s = Math.sqrt(1 + m[8] - m[0] - m[4]) * 2
    q = [(m[2] + m[6]) / s, (m[5] + m[7]) / s, s / 4, (m[3] - m[1]) / s]
  }
  const l = Math.hypot(...q)
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]
}
/** A matrix whose columns are the basis vectors x, y, z (each the image of a local axis). */
export function basis(x: V3, y: V3, z: V3): R3 {
  return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]]
}

export const IDENTITY: M = [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]
export function compose(rotation: Q, translation: V3): M {
  return [...qmat(rotation), ...translation]
}
/** One element of the row-major 3x3 product a · b. */
const rowCol = (a: M | R3, b: M | R3, r: number, c: number): number =>
  (a[r * 3] as number) * (b[c] as number) +
  (a[r * 3 + 1] as number) * (b[3 + c] as number) +
  (a[r * 3 + 2] as number) * (b[6 + c] as number)
/** a · b: b first, then a. Written out element by element (M3.6a: the solver calls it thousands of times a
 * second; the source's `flatMap` form cost about four times as much), with the source's sums in its order, so
 * every result is bit-identical to the source's. */
export function mmul(a: M, b: M): M {
  return [
    rowCol(a, b, 0, 0),
    rowCol(a, b, 0, 1),
    rowCol(a, b, 0, 2),
    rowCol(a, b, 1, 0),
    rowCol(a, b, 1, 1),
    rowCol(a, b, 1, 2),
    rowCol(a, b, 2, 0),
    rowCol(a, b, 2, 1),
    rowCol(a, b, 2, 2),
    a[0] * b[9] + a[1] * b[10] + a[2] * b[11] + a[9],
    a[3] * b[9] + a[4] * b[10] + a[5] * b[11] + a[10],
    a[6] * b[9] + a[7] * b[10] + a[8] * b[11] + a[11],
  ]
}
/** The row-major 3x3 product a · b of two rotations (written out as `mmul`). */
export function mul3(a: R3, b: R3): R3 {
  return [
    rowCol(a, b, 0, 0),
    rowCol(a, b, 0, 1),
    rowCol(a, b, 0, 2),
    rowCol(a, b, 1, 0),
    rowCol(a, b, 1, 1),
    rowCol(a, b, 1, 2),
    rowCol(a, b, 2, 0),
    rowCol(a, b, 2, 1),
    rowCol(a, b, 2, 2),
  ]
}
export function transpose3(m: R3): R3 {
  return [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]
}
export function apply(m: M, p: V3): V3 {
  return [
    m[0] * p[0] + m[1] * p[1] + m[2] * p[2] + m[9],
    m[3] * p[0] + m[4] * p[1] + m[5] * p[2] + m[10],
    m[6] * p[0] + m[7] * p[1] + m[8] * p[2] + m[11],
  ]
}
export function applyDir(m: M, v: V3): V3 {
  return [
    m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
    m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
    m[6] * v[0] + m[7] * v[1] + m[8] * v[2],
  ]
}
/** The inverse of a rigid transform (rotation and translation only). */
export function invertRigid(m: M): M {
  const r: R3 = [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]]
  const t: V3 = [m[9], m[10], m[11]]
  return [
    ...r,
    -(r[0] * t[0] + r[1] * t[1] + r[2] * t[2]),
    -(r[3] * t[0] + r[4] * t[1] + r[5] * t[2]),
    -(r[6] * t[0] + r[7] * t[1] + r[8] * t[2]),
  ]
}
export const position = (m: M): V3 => [m[9], m[10], m[11]]
export const rotationOf = (m: M): R3 => [m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8]]
/** Deterministic hash noise in [0, 1) for an integer, for twitches and part jitter that must repeat exactly. */
export function hash(n: number): number {
  let x = Math.imul(n | 0, 0x27d4eb2d)
  x = Math.imul(x ^ (x >>> 15), 0x85ebca6b)
  x ^= x >>> 13
  return (x >>> 0) / 4294967296
}
