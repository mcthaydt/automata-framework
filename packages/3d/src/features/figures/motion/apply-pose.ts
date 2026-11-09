// A pose as a solve's input: the base pose with the pose's fk joints and root
// offset applied, and the pose's handles as `Targets`. It is what the Studio needs to show one pose and what
// the tests solve; layering poses and clips over locomotion is `evaluate`'s.

import { apply, axisAngle, compose, qmul, scale } from '../../../shared/math/math.ts'
import { at, clonePose, J, JOINTS, type Pose, type Skeleton } from '../body/rig.ts'
import type { PoseDef } from './pose.schema.ts'
import { eulerDegrees, radians } from './rotation.ts'
import type { Targets } from './targets.ts'

/**
 * `base` with `pose` applied, and the targets for `solve`. An fk turn is extra: it multiplies the joint's
 * local rotation. The root's `pos` is in figure units in the figure's own frame (where the sim put it and how
 * it faces), and its `yaw`, in degrees, turns it after that. `base` is not changed.
 */
export function applyPose(skeleton: Skeleton, base: Pose, pose: PoseDef): { base: Pose; targets: Targets } {
  const posed = clonePose(base)
  for (const joint of JOINTS) {
    const turn = pose.fk?.[joint]
    if (turn) posed.rot[J[joint]] = qmul(at(posed.rot, J[joint]), eulerDegrees(turn))
  }
  const k = skeleton.genes.height / 1.62
  if (pose.root?.pos)
    posed.root = apply(compose(axisAngle([0, 1, 0], base.yaw), base.root), scale([...pose.root.pos], k))
  if (pose.root?.yaw !== undefined) posed.yaw = base.yaw + radians(pose.root.yaw)
  return { base: posed, targets: { effectors: pose.effectors, poles: pose.poles ?? {}, aim: [], pins: {} } }
}
