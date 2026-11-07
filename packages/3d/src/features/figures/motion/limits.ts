// Joint limits: how the solver reads each limited joint against the content's `RigLimits` and
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

import {
  axisAngle,
  cross,
  euler,
  length,
  normalize,
  type Q,
  qmat,
  qmul,
  type V3,
} from '../../../shared/math/math.ts'
import { at, J, type Pose } from '../body/rig.ts'
import type { Range, RigLimits } from '../content/rig-limits.schema.ts'
import { degrees, eulerOf, radians } from './rotation.ts'

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

/** `a` wrapped into (−π, π]. */
const wrap = (a: number): number => a - 2 * Math.PI * Math.ceil((a - Math.PI) / (2 * Math.PI))

/**
 * A hinge's bend (radians) moved onto its range: unchanged inside it, else onto the bound nearer round the
 * circle, so a knee bent −170° (190° the other way) goes to 150°, not to 0°.
 */
function hingeClamp(bend: number, r: Range): number {
  const lo = radians(r.min),
    hi = radians(r.max)
  if (bend >= lo && bend <= hi) return bend
  return Math.abs(wrap(bend - lo)) <= Math.abs(wrap(bend - hi)) ? lo : hi
}

/** `v` (radians) brought into `r` (degrees); unchanged with no range. */
const clampTo = (v: number, r: Range | undefined): number =>
  r ? Math.min(radians(r.max), Math.max(radians(r.min), v)) : v

/**
 * The euler ranges' clamp. Every rotation has two eulers: (p, y, r), with p in [−90°, 90°], and
 * (180° − p, y + 180°, r + 180°). A head pitched 96° reads first as (84°, 180°, 180°); clamping that would
 * swing the yaw and roll to their bounds, so both readings are clamped and the one that needs the smaller
 * correction wins. Returns the clamped euler and the correction (radians, summed over the three angles).
 */
function eulerClamp(q: Q, limit: Extract<JointLimit, { kind: 'euler' }>): { angles: V3; correction: number } {
  const [p0, y0, r0] = eulerOf(q)
  let best: { angles: V3; correction: number } | undefined
  for (const [p, y, r] of [
    [p0, y0, r0],
    [wrap(Math.PI - p0), wrap(y0 + Math.PI), wrap(r0 + Math.PI)],
  ] as const) {
    const angles: V3 = [clampTo(p, limit.pitch), clampTo(y, limit.yaw), clampTo(r, limit.roll)]
    const correction = Math.abs(angles[0] - p) + Math.abs(angles[1] - y) + Math.abs(angles[2] - r)
    if (!best || correction < best.correction) best = { angles, correction }
  }
  return best as { angles: V3; correction: number }
}

/** How far `q` is past `limit`, in degrees: 0 inside it (or with no limit). For an euler range, the
 * correction the clamp would make, summed over its angles. */
export function limitExcess(q: Q, limit: JointLimit | undefined): number {
  if (!limit) return 0
  if (limit.kind === 'hinge') {
    const bend = radians(hingeFlexion(q, limit.joint))
    return degrees(Math.abs(wrap(hingeClamp(bend, limit.range) - bend)))
  }
  if (limit.kind === 'cone') return Math.max(0, swingAngle(q) - limit.cone)
  return degrees(eulerClamp(q, limit).correction)
}

/** `q` clamped to `limit`, or null when it is inside (or the joint has no limit). */
export function clampJoint(q: Q, limit: JointLimit | undefined): Q | null {
  if (!limit) return null
  if (limit.kind === 'hinge') {
    const sign = limit.joint === 'knee' ? 1 : -1
    const flexion = sign * bendAboutX(q)
    const clamped = hingeClamp(flexion, limit.range)
    if (clamped === flexion) return null
    // Turning about the parent's x moves the bone within the y–z plane, so its bend lands on the bound.
    return qmul(axisAngle([1, 0, 0], sign * wrap(clamped - flexion)), q)
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
  const { angles, correction } = eulerClamp(q, limit)
  return correction === 0 ? null : euler(angles[0], angles[1], angles[2])
}

/** Clamps each of `joints` in `pose` to its limit, adding every joint it moved to `limited`; true if any moved. */
export function clampJoints(
  pose: Pose,
  joints: readonly number[],
  table: ReadonlyMap<number, JointLimit>,
  limited: Set<number>,
): boolean {
  let moved = false
  for (const joint of joints) {
    const clamped = clampJoint(at(pose.rot, joint), table.get(joint))
    if (!clamped) continue
    pose.rot[joint] = clamped
    limited.add(joint)
    moved = true
  }
  return moved
}
