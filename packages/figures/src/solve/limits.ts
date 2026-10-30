// Joint limits (M3 spec §4.4.2): how the solver reads each limited joint against the content's `RigLimits` and
// clamps it. Every reading is of the joint's local rotation, in degrees:
//
// - Hinges (elbows, knees): the bend about the joint's local x, as flexion: a knee bends back (+x), an elbow
//   forward (−x), the way the source's `twoBoneIK` and `base()` bend them.
// - Cones (shoulders, hips): the bone's swing from hanging straight down (its local −y), whatever its twist.
// - Euler ranges (spine, chest, neck, head): the source's euler (yaw · pitch · roll) of the local rotation. The
//   chest's twist and pitch ranges are shared by `spine` and `chest` by the posture split (0.3 and 0.7 of each
//   bound), so the torso as a whole stays inside them.
//
// A clamp turns only the part past the bound back onto it, so a joint inside its limits is never touched, and a
// clamped one is exactly on its bound.

import type { Range, RigLimits } from '../library/rig-limits.schema'
import { axisAngle, cross, euler, length, normalize, type Q, qmat, qmul, type V3 } from '../math/math'
import { J } from '../rig/rig'
import { degrees, eulerOf, radians } from './rotation'

export type JointLimit =
  | { readonly kind: 'hinge'; readonly joint: 'knee' | 'elbow'; readonly range: Range }
  | { readonly kind: 'cone'; readonly cone: number }
  | {
      readonly kind: 'euler'
      readonly pitch?: Range | undefined
      readonly yaw?: Range | undefined
      readonly roll?: Range | undefined
    }

/** The posture split (FigureBuilder `motion.ts` `base()` at a1f7246): spine 0.3, chest 0.7. */
export const CHEST_SHARES = { spine: 0.3, chest: 0.7 } as const

const share = (r: Range, k: number): Range => ({ min: r.min * k, max: r.max * k })

/** Each limited joint's limit, by joint index. Joints not in the table are not limited. */
export function jointLimits(limits: RigLimits): ReadonlyMap<number, JointLimit> {
  const table = new Map<number, JointLimit>()
  for (const side of ['L', 'R'] as const) {
    table.set(J[`shin.${side}`], { kind: 'hinge', joint: 'knee', range: limits.knee })
    table.set(J[`foreArm.${side}`], { kind: 'hinge', joint: 'elbow', range: limits.elbow })
    table.set(J[`thigh.${side}`], { kind: 'cone', cone: limits.hip.cone })
    table.set(J[`upperArm.${side}`], { kind: 'cone', cone: limits.shoulder.cone })
  }
  const { twist, pitch } = limits.chest
  table.set(J.spine, {
    kind: 'euler',
    yaw: share(twist, CHEST_SHARES.spine),
    pitch: share(pitch, CHEST_SHARES.spine),
  })
  table.set(J.chest, {
    kind: 'euler',
    yaw: share(twist, CHEST_SHARES.chest),
    pitch: share(pitch, CHEST_SHARES.chest),
  })
  table.set(J.neck, { kind: 'euler', yaw: limits.neck.yaw, pitch: limits.neck.pitch })
  table.set(J.head, { kind: 'euler', ...limits.head })
  return table
}

/** The bone's direction in its parent's frame: the local −y axis turned by `q`. */
function boneDirection(q: Q): V3 {
  const m = qmat(q)
  return [-m[1], -m[4], -m[7]]
}

/** The angle about +x, in radians, that turns a bone hanging along −y to `q`'s bone, in the y–z plane. */
const bendAboutX = (q: Q): number => {
  const [, dy, dz] = boneDirection(q)
  return Math.atan2(-dz, -dy)
}

/** A knee's or elbow's flexion in degrees: a knee bent back or an elbow bent forward is positive. */
export function hingeFlexion(q: Q, joint: 'knee' | 'elbow'): number {
  return degrees(bendAboutX(q)) * (joint === 'knee' ? 1 : -1)
}

/** A shoulder's or hip's swing in degrees: the bone's angle from hanging straight down. */
export function swingAngle(q: Q): number {
  const [, dy] = boneDirection(q)
  return degrees(Math.acos(Math.max(-1, Math.min(1, -dy))))
}

const clampTo = (v: number, r: Range | undefined): number =>
  r ? Math.min(radians(r.max), Math.max(radians(r.min), v)) : v

/** `q` clamped to `limit`, or null when it is inside (or the joint has no limit). */
export function clampJoint(q: Q, limit: JointLimit | undefined): Q | null {
  if (!limit) return null
  if (limit.kind === 'hinge') {
    const sign = limit.joint === 'knee' ? 1 : -1
    const flexion = sign * bendAboutX(q)
    const clamped = clampTo(flexion, limit.range)
    if (clamped === flexion) return null
    // Turning about the parent's x moves the bone within the y–z plane, so its bend lands on the bound.
    return qmul(axisAngle([1, 0, 0], sign * (clamped - flexion)), q)
  }
  if (limit.kind === 'cone') {
    const dir = boneDirection(q)
    const swing = Math.acos(Math.max(-1, Math.min(1, -dir[1])))
    const excess = swing - radians(limit.cone)
    if (excess <= 0) return null
    // Swing back toward straight down about the axis between the bone and −y; a bone pointing straight up has
    // no such axis, so it swings back about x.
    const axis = cross(dir, [0, -1, 0])
    return qmul(axisAngle(length(axis) < 1e-12 ? [1, 0, 0] : normalize(axis), excess), q)
  }
  const [pitch, yaw, roll] = eulerOf(q)
  const p = clampTo(pitch, limit.pitch),
    y = clampTo(yaw, limit.yaw),
    r = clampTo(roll, limit.roll)
  return p === pitch && y === yaw && r === roll ? null : euler(p, y, r)
}
