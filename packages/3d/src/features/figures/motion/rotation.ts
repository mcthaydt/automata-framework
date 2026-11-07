// Rotation helpers the solver needs beyond M3.5a's math: degrees, slerp, and reading a quaternion back as the
// source's euler angles, which is how the limits are stated.

import { euler, type Q, qconj, qmat, qmul } from '../../../shared/math/math.ts'

export const radians = (deg: number): number => (deg * Math.PI) / 180
export const degrees = (rad: number): number => (rad * 180) / Math.PI

/** The euler of `rot` in degrees (pitch, yaw, roll), as the math's `euler` takes them in radians. */
export function eulerDegrees(rot: readonly [number, number, number]): Q {
  return euler(radians(rot[0]), radians(rot[1]), radians(rot[2]))
}

/**
 * (pitch, yaw, roll) in radians such that `euler(pitch, yaw, roll)` is `q`. `euler` is Ry(yaw) · Rx(pitch) ·
 * Rz(roll), whose matrix has m12 = −sin(pitch), m02 / m22 = tan(yaw) and m10 / m11 = tan(roll).
 */
export function eulerOf(q: Q): [number, number, number] {
  const m = qmat(q)
  // cos(pitch) is hypot(m02, m22); atan2 keeps pitch exact near ±90°, where asin(−m12) loses half its digits.
  const cos = Math.hypot(m[2], m[8])
  const pitch = Math.atan2(-m[5], cos)
  // At pitch ±90° (gimbal lock) cos(pitch) is 0, so m02, m22, m10 and m11 are rounding noise and atan2 of them
  // is arbitrary. Yaw and roll then turn about one axis and only yaw ∓ roll is defined: read it as yaw with roll
  // 0, from m00 = cos(yaw ∓ roll) and m20 = −sin(yaw ∓ roll).
  if (cos < 1e-9) return [pitch, Math.atan2(-m[6], m[0]), 0]
  return [pitch, Math.atan2(m[2], m[8]), Math.atan2(m[3], m[4])]
}

/** Spherical interpolation from a (k = 0) to b (k = 1), along the shorter arc. */
export function slerp(a: Q, b: Q, k: number): Q {
  let cos = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3]
  const sign = cos < 0 ? -1 : 1
  cos *= sign
  let wa: number, wb: number
  if (cos > 1 - 1e-12) {
    wa = 1 - k
    wb = k
  } else {
    const angle = Math.acos(cos),
      sin = Math.sin(angle)
    wa = Math.sin((1 - k) * angle) / sin
    wb = Math.sin(k * angle) / sin
  }
  wb *= sign
  const q: Q = [wa * a[0] + wb * b[0], wa * a[1] + wb * b[1], wa * a[2] + wb * b[2], wa * a[3] + wb * b[3]]
  const l = Math.hypot(...q)
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l]
}

/** The angle in radians of the rotation taking a to b; atan2 of the relative rotation's parts, which stays
 * exact near zero where acos does not. */
export function angleBetween(a: Q, b: Q): number {
  const [x, y, z, w] = qmul(qconj(a), b)
  return 2 * Math.atan2(Math.hypot(x, y, z), Math.abs(w))
}
