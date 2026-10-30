// sample (M3 spec §4.4.4): the pose a clip holds at a clip time. Keys hold handles, not joint angles, so the
// neighbouring keys' poses are blended (M3.6b's `blend`) at the eased fraction and the caller solves the result.
//
// Keys in different spaces: when a channel is in chest space at one key and root space at the next, `blend`
// refuses the pair, because converting needs the chest's frame, which a pose does not have. The sampler takes
// it as an input (`context.chest`: the chest joint in root space, from the pose evaluated so far, §4.4.5 steps
// 1 and 2), converts that channel's chest-space side to root space, and blends there. Without the frame a mixed
// pair throws, naming the channel. Channels whose spaces agree stay in their space.

import { apply, applyDir, invertRigid, type M, matq, mmul, mul3, qmat, rotationOf } from '../math/math'
import { blend } from '../pose/blend'
import type { PoseDef } from '../pose/pose.schema'
import { EFFECTOR_IDS, POLE_IDS } from '../pose/pose-spelling'
import { at, J, type Skeleton } from '../rig/rig'
import { degrees, eulerDegrees, eulerOf } from '../solve/rotation'
import type { EffectorId, EffectorTarget, PoleId, PoleTarget, Space, Vec3 } from '../solve/targets'
import type { ClipKey, FigureClipDef } from './clip.schema'
import { easeAt } from './ease'

/** The `figure-pose` content a clip's keys name, by id. */
export type PoseLibrary = Readonly<Record<string, PoseDef>>

export interface SampleContext {
  /** The chest joint's frame in root space, translation in figure units (`chestFrame`), from the layers below. */
  readonly chest?: M | undefined
}

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

const spaceOf = (target: { readonly space?: Space | undefined } | undefined): Space => target?.space ?? 'root'

/** The channels in different spaces in `a` and `b`: effectors both name, and poles either names (a pole one
 * leaves out is its default, in root space). */
export function mixedChannels(a: PoseDef, b: PoseDef): { effectors: EffectorId[]; poles: PoleId[] } {
  const effectors = EFFECTOR_IDS.filter((id) => {
    const [x, y] = [a.effectors[id], b.effectors[id]]
    return x !== undefined && y !== undefined && spaceOf(x) !== spaceOf(y)
  })
  const poles = POLE_IDS.filter((id) => {
    const [x, y] = [a.poles?.[id], b.poles?.[id]]
    return (x !== undefined || y !== undefined) && spaceOf(x) !== spaceOf(y)
  })
  return { effectors, poles }
}

function turnIn(chest: M, rot: Vec3): Vec3 {
  const [pitch, yaw, roll] = eulerOf(matq(mul3(rotationOf(chest), qmat(eulerDegrees(rot)))))
  return [degrees(pitch), degrees(yaw), degrees(roll)]
}
function targetInRoot(target: EffectorTarget, chest: M): EffectorTarget {
  const { space: _space, ...rest } = target
  return {
    ...rest,
    ...(target.pos ? { pos: apply(chest, [...target.pos]) } : {}),
    ...(target.rot ? { rot: turnIn(chest, target.rot) } : {}),
  }
}
const poleInRoot = (pole: PoleTarget, chest: M): PoleTarget => ({ dir: applyDir(chest, [...pole.dir]) })

/** `pose` with the named channels that are in chest space moved to root space. */
function inRoot(pose: PoseDef, mixed: ReturnType<typeof mixedChannels>, chest: M): PoseDef {
  const effectors = { ...pose.effectors }
  for (const id of mixed.effectors) {
    const target = effectors[id]
    if (target && spaceOf(target) === 'chest') effectors[id] = targetInRoot(target, chest)
  }
  const poles = { ...pose.poles }
  for (const id of mixed.poles) {
    const pole = poles[id]
    if (pole && spaceOf(pole) === 'chest') poles[id] = poleInRoot(pole, chest)
  }
  return { ...pose, effectors, ...(pose.poles ? { poles } : {}) }
}

/** The pose `clip` holds at clip time `t` (clamped to [0, length]); see the file's note on spaces. */
export function sample(
  clip: FigureClipDef,
  t: number,
  poses: PoseLibrary,
  context: SampleContext = {},
): PoseDef {
  const { keys } = clip
  const time = Math.min(Math.max(t, 0), clip.length)
  let i = 0
  while (i + 1 < keys.length && (keys[i + 1]?.t ?? Number.POSITIVE_INFINITY) <= time) i++
  const from = at(keys, i)
  const to = keys[i + 1]
  if (!to) return poseOf(from, poses)
  const u = easeAt(to.ease, (time - from.t) / (to.t - from.t))
  if (u === 0) return poseOf(from, poses)
  if (u === 1) return poseOf(to, poses)
  let [a, b] = [poseOf(from, poses), poseOf(to, poses)]
  const mixed = mixedChannels(a, b)
  if (mixed.effectors.length > 0 || mixed.poles.length > 0) {
    if (!context.chest) {
      const names = [...mixed.effectors, ...mixed.poles].join(', ')
      throw new RangeError(
        `${names} changes space between keys ${i} and ${i + 1}: sample needs the chest frame`,
      )
    }
    a = inRoot(a, mixed, context.chest)
    b = inRoot(b, mixed, context.chest)
  }
  return blend(a, b, u)
}
