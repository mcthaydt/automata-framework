// The body handles: `pelvis` moves and turns the hips; `chest` is a turn shared by `spine` and
// `chest` (the source's posture split, 0.3/0.7); `head` is a turn shared by `neck` and `head` (the source's head
// split, 0.4/0.6; FigureBuilder `motion.ts` `base()` at a1f7246). Each writes local rotations, blended from the
// base pose by the handle's weight; each returns the local rotations it wanted, so the report can say how far a
// limit kept them.

import { add, lerp3, type Q, sub, type V3 } from '../../../shared/math/math.ts'
import { at, J, type Pose, type Skeleton } from '../body/rig.ts'
import { CHEST_SHARES } from './limits.ts'
import { eulerDegrees, slerp } from './rotation.ts'
import type { EffectorTarget, Vec3 } from './targets.ts'

/** The head split: neck 0.4, head 0.6. */
export const HEAD_SHARES = { neck: 0.4, head: 0.6 } as const

const part = (rot: Vec3, share: number): Vec3 => [rot[0] * share, rot[1] * share, rot[2] * share]

/** Sets `joints`' local rotations to shares of `rot`, blended by `weight`; returns what each wanted. */
function shareTurn(
  pose: Pose,
  rot: Vec3,
  weight: number,
  joints: readonly (readonly [number, number])[],
): Map<number, Q> {
  const wanted = new Map<number, Q>()
  for (const [joint, share] of joints) {
    const turn = slerp(at(pose.rot, joint), eulerDegrees(part(rot, share)), weight)
    pose.rot[joint] = turn
    wanted.set(joint, turn)
  }
  return wanted
}

/** The pelvis: `pos` is its joint's position in root space (figure units), `rot` its local turn. */
export function placePelvis(s: Skeleton, pose: Pose, effector: EffectorTarget, k: number): Map<number, Q> {
  const weight = effector.weight ?? 1
  if (effector.pos) {
    const shift = sub([effector.pos[0] * k, effector.pos[1] * k, effector.pos[2] * k], at(s.offset, J.pelvis))
    pose.shift[J.pelvis] = lerp3(at(pose.shift, J.pelvis), shift, weight)
  }
  return effector.rot ? shareTurn(pose, effector.rot, weight, [[J.pelvis, 1]]) : new Map()
}

/** The pelvis joint's position in root space as the pose has it, in metres. */
export const pelvisInRoot = (s: Skeleton, pose: Pose): V3 =>
  add(at(s.offset, J.pelvis), at(pose.shift, J.pelvis))

export function turnChest(pose: Pose, effector: EffectorTarget): Map<number, Q> {
  if (!effector.rot) return new Map()
  return shareTurn(pose, effector.rot, effector.weight ?? 1, [
    [J.spine, CHEST_SHARES.spine],
    [J.chest, CHEST_SHARES.chest],
  ])
}

export function turnHead(pose: Pose, effector: EffectorTarget): Map<number, Q> {
  if (!effector.rot) return new Map()
  return shareTurn(pose, effector.rot, effector.weight ?? 1, [
    [J.neck, HEAD_SHARES.neck],
    [J.head, HEAD_SHARES.head],
  ])
}
