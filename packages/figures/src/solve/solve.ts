// solve(): turns the rig's handles (targets.ts) into joint rotations (M3 spec §4.4.2). Pure: a function of its
// arguments only, no clock, no Math.random; `base` is never written.
//
// Order (§4.4.5 step 5): limbs, then the report.

import type { RigLimits } from '../library/rig-limits.schema'
import {
  apply,
  applyDir,
  lerp3,
  type M,
  matq,
  mul3,
  qmat,
  type R3,
  rotationOf,
  scale,
  sub,
  transpose3,
  type V3,
} from '../math/math'
import { at, clonePose, fk, J, type Pose, type Skeleton } from '../rig/rig'
import { defaultPole, LIMB_IDS, LIMBS, solveLimb } from './limbs'
import { eulerDegrees, slerp } from './rotation'
import type { EffectorId, Reach, SolveReport, Space, Targets } from './targets'

/** A position is reached within this many figure units. */
const POSITION_TOLERANCE = 1e-6

export interface Solved {
  readonly pose: Pose
  readonly world: M[]
  readonly report: SolveReport
}

const spaceOf = (world: readonly M[], space: Space | undefined): M =>
  at(world, space === 'chest' ? J.chest : J.root)

export function solve(skeleton: Skeleton, base: Pose, targets: Targets, limits: RigLimits): Solved {
  void limits
  const k = skeleton.genes.height / 1.62
  const pose = clonePose(base)
  let world = fk(skeleton, pose)
  const wanted = new Map<EffectorId, V3>()

  for (const limb of LIMB_IDS) {
    const effector = targets.effectors[limb]
    const pin = targets.pins[limb]
    const weight = effector?.weight ?? 1
    const [, middle, end] = LIMBS[limb].chain
    const space = spaceOf(world, effector?.space)
    let endTurn: R3 | undefined
    if (effector?.rot) {
      const turn = mul3(rotationOf(space), qmat(eulerDegrees(effector.rot)))
      endTurn = qmat(slerp(matq(rotationOf(at(world, end))), matq(turn), weight))
    }
    let target: V3 | undefined
    if (pin) target = [...pin]
    else if (effector?.pos)
      target = lerp3(apply(at(world, end), [0, 0, 0]), apply(space, scale([...effector.pos], k)), weight)
    if (target) {
      const poleTarget = targets.poles[LIMBS[limb].pole]
      const pole = poleTarget
        ? applyDir(spaceOf(world, poleTarget.space), [...poleTarget.dir])
        : defaultPole(limb, at(world, J.root))
      solveLimb(skeleton, pose, world, limb, target, pole, endTurn)
      wanted.set(limb, target)
      world = fk(skeleton, pose)
    } else if (endTurn) {
      // A turn without a position: the end turns in place.
      pose.rot[end] = matq(mul3(transpose3(rotationOf(at(world, middle))), endTurn))
      world = fk(skeleton, pose)
    }
  }

  const reached: Partial<Record<EffectorId | 'aim', Reach>> = {}
  for (const [id, target] of wanted) {
    const endJoint = LIMBS[id as keyof typeof LIMBS].chain[2]
    const error = Math.hypot(...sub(apply(at(world, endJoint), [0, 0, 0]), target)) / k
    reached[id] = { ok: error <= POSITION_TOLERANCE, error }
  }
  return { pose, world, report: { reached, limited: [] } }
}
