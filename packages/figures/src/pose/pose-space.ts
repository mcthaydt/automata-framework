// Handles in different spaces (M3 spec §4.4.4, "keys in different spaces"): when a channel is in chest space in
// one pose and root space in the other, the two are interpolated in root space, converting the chest-space side
// through the chest's frame. A pose has no chest frame of its own; the caller supplies the one the layers below
// it left (§4.4.5 steps 1 and 2): the clip sampler and the action transition.

import { apply, applyDir, type M, matq, mul3, qmat, rotationOf } from '../math/math'
import { degrees, eulerDegrees, eulerOf } from '../solve/rotation'
import type { EffectorId, EffectorTarget, PoleId, PoleTarget, Space, Vec3 } from '../solve/targets'
import type { PoseDef } from './pose.schema'
import { EFFECTOR_IDS, POLE_IDS } from './pose-spelling'

/** What converting between spaces needs. */
export interface SpaceContext {
  /** The chest joint's frame in root space, its translation in figure units, from the layers below. */
  readonly chest?: M | undefined
}

export interface MixedChannels {
  readonly effectors: readonly EffectorId[]
  readonly poles: readonly PoleId[]
}

const spaceOf = (target: { readonly space?: Space | undefined } | undefined): Space => target?.space ?? 'root'

/**
 * The channels of `a` and `b` in different spaces: effectors both name (one only one names fades, so its space
 * does not matter), and poles either names (a pole one leaves out is its limb's default, in root space).
 */
export function mixedChannels(a: PoseDef, b: PoseDef): MixedChannels {
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

export const isMixed = (mixed: MixedChannels): boolean => mixed.effectors.length > 0 || mixed.poles.length > 0

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

/** `pose` with the `mixed` channels that are in chest space moved to root space through `chest`. */
export function inRoot(pose: PoseDef, mixed: MixedChannels, chest: M): PoseDef {
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

/** Both poses with their mixed channels in root space; without a chest frame, a RangeError naming them. */
export function inOneSpace(a: PoseDef, b: PoseDef, context: SpaceContext, where: string): [PoseDef, PoseDef] {
  const mixed = mixedChannels(a, b)
  if (!isMixed(mixed)) return [a, b]
  if (!context.chest) {
    const names = [...mixed.effectors, ...mixed.poles].join(', ')
    throw new RangeError(
      `${names} ${mixed.effectors.length + mixed.poles.length > 1 ? 'are' : 'is'} in chest space on one side and root space on the other ${where}: blending them needs the chest frame`,
    )
  }
  return [inRoot(a, mixed, context.chest), inRoot(b, mixed, context.chest)]
}
