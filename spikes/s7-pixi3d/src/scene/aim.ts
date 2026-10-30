// Aiming (spike S7): the head turns toward a world point and one arm reaches toward it with The Last Light's
// analytic two-bone IK (`twoBoneIK`, FigureBuilder src/render/figure/rig.ts at a1f7246). Also the four-limb
// solve S7-Q8 times: both feet onto floor targets and both hands onto targets. These use the source's allocating
// solver as it is (S7-Q8 says: the allocating one first, typed buffers only if it misses).

import { euler, length, normalize, position, sub, type V3 } from '../figure/math.ts'
import { fk, J, type Pose, type Side, type Skeleton, twoBoneIK } from '../figure/rig.ts'

/** Turns the head toward `target` (world), in the figure's own frame (yaw only on the root). */
export function aimHead(s: Skeleton, pose: Pose, target: V3): void {
  const world = fk(s, pose)
  const head = position(world[J.head]!)
  const d = sub(target, head)
  const c = Math.cos(-pose.yaw)
  const sn = Math.sin(-pose.yaw)
  const local: V3 = [d[0] * c + d[2] * sn, d[1], -d[0] * sn + d[2] * c]
  const yaw = Math.atan2(local[0], local[2])
  const pitch = -Math.atan2(local[1], Math.hypot(local[0], local[2]))
  pose.rot[J.head] = euler(Math.max(-0.6, Math.min(0.6, pitch)), Math.max(-1.2, Math.min(1.2, yaw)), 0)
}

/** Reaches one arm toward `target`, the hand stopping short at 95% of the arm's length. */
export function reachArm(s: Skeleton, pose: Pose, side: Side, target: V3): void {
  const world = fk(s, pose)
  const shoulder = position(world[J[`upperArm.${side}`]]!)
  const toward = normalize(sub(target, shoulder))
  const reach = Math.min(length(sub(target, shoulder)), 0.95 * (s.upperArm + s.foreArm))
  const hand: V3 = [
    shoulder[0] + toward[0] * reach,
    shoulder[1] + toward[1] * reach,
    shoulder[2] + toward[2] * reach,
  ]
  const back: V3 = [-Math.sin(pose.yaw), -0.5, -Math.cos(pose.yaw)]
  twoBoneIK(s, pose, world, J[`upperArm.${side}`], J[`foreArm.${side}`], J[`hand.${side}`], hand, back, -1)
}

export interface LimbTargets {
  readonly footL: V3
  readonly footR: V3
  readonly handL: V3
  readonly handR: V3
}

/** The four limb solves (S7-Q8): legs bend toward the figure's front, arms toward its back. */
export function solveLimbs(s: Skeleton, pose: Pose, targets: LimbTargets): void {
  const world = fk(s, pose)
  const front: V3 = [Math.sin(pose.yaw), 0, Math.cos(pose.yaw)]
  const back: V3 = [-front[0], -0.5, -front[2]]
  twoBoneIK(s, pose, world, J['thigh.L'], J['shin.L'], J['foot.L'], targets.footL, front, 1)
  twoBoneIK(s, pose, world, J['thigh.R'], J['shin.R'], J['foot.R'], targets.footR, front, 1)
  twoBoneIK(s, pose, world, J['upperArm.L'], J['foreArm.L'], J['hand.L'], targets.handL, back, -1)
  twoBoneIK(s, pose, world, J['upperArm.R'], J['foreArm.R'], J['hand.R'], targets.handR, back, -1)
}
