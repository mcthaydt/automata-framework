// blendKeyPoses: the pose a clip holds at a clip time. Keys hold handles, not joint angles, so the
// neighbouring keys' poses are blended (`blendAt`, which follows an overshooting ease past the key) at
// the eased fraction, and the caller solves the result.
//
// Keys in different spaces: a channel in chest space at one key and root space at the next is blended in root
// space through the chest frame the caller passes (`context.chest`: the chest joint in root space, from the pose
// evaluated so far; pose/pose-space.ts converts). Without it such a pair throws, naming
// the channel. Channels whose spaces agree stay in their space.

import { invertRigid, type M, mmul } from '../../../shared/math/math.ts'
import { bracket } from '../../../shared/timeline/sample.ts'
import { at, J, type Skeleton } from '../body/rig.ts'
import { blendAt } from '../motion/blend.ts'
import type { PoseDef } from '../motion/pose.schema.ts'
import type { SpaceContext } from '../motion/pose-space.ts'
import type { ClipKey, FigureClipDef } from './clip.schema.ts'

/** The `figure-pose` content a clip's keys name, by id. */
export type PoseLibrary = Readonly<Record<string, PoseDef>>

/** The chest joint's frame in the root's, its translation in figure units, from a solved `world`. */
export function chestFrame(skeleton: Skeleton, world: readonly M[]): M {
  const m = mmul(invertRigid(at(world, J.root)), at(world, J.chest))
  const k = skeleton.genes.height / 1.62
  return [m[0], m[1], m[2], m[3], m[4], m[5], m[6], m[7], m[8], m[9] / k, m[10] / k, m[11] / k]
}

/** A key's pose: written inline, or looked up by id. */
function poseOf(key: ClipKey, poses: PoseLibrary): PoseDef {
  if (typeof key.pose !== 'string') return key.pose
  const pose = poses[key.pose]
  if (!pose) throw new RangeError(`no figure-pose has the id ${key.pose}`)
  return pose
}

/** The pose `clip` holds at clip time `t` (clamped to [0, length]); see the file's note on spaces. */
export function blendKeyPoses(
  clip: FigureClipDef,
  t: number,
  poses: PoseLibrary,
  context: SpaceContext = {},
): PoseDef {
  const place = bracket(clip.keys, Math.min(Math.max(t, 0), clip.length))
  if (!place) throw new RangeError('a clip has no keys')
  const { a: from, b: to, u } = place
  if (u === 0) return poseOf(from, poses)
  if (u === 1) return poseOf(to, poses)
  // Mixed spaces convert through the chest frame (pose-space.ts); overshooting eases extrapolate.
  return blendAt(poseOf(from, poses), poseOf(to, poses), u, context)
}
