// Forward kinematics for one joint's chain: the world transforms of `joint` and its ancestors only, the rest
// of the array left empty. The aim's steps need the pelvis and the aimed part, and a re-solved foot its base
// turn; a whole `fk` (rig.ts) for each would cost several times as much. The same products in the same order
// as `fk`, so the numbers are identical.

import { add, axisAngle, compose, type M, mmul } from '../../../shared/math/math.ts'
import { at, PARENTS, type Pose, type Skeleton } from '../body/rig.ts'

export function chainWorld(s: Skeleton, pose: Pose, joint: number): M[] {
  const chain: number[] = []
  for (let j = joint; j >= 0; j = at(PARENTS, j)) chain.unshift(j)
  const world: M[] = []
  for (const j of chain) {
    const parent = at(PARENTS, j)
    world[j] =
      parent < 0
        ? mmul(compose(axisAngle([0, 1, 0], pose.yaw), pose.root), compose(at(pose.rot, j), [0, 0, 0]))
        : mmul(at(world, parent), compose(at(pose.rot, j), add(at(s.offset, j), at(pose.shift, j))))
  }
  return world
}
