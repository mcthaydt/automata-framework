// solve(): turns the rig's handles (targets.ts) into joint rotations (M3 spec §4.4.2). Pure: a function of its
// arguments only, no clock, no Math.random; `base` is never written.
//
// Order (§4.4.5 step 5): the hips, the chest and the head (torso.ts), then the limbs (limbs.ts), the feet
// re-solving onto their base places when the hips moved, then the report.

import type { RigLimits } from '../library/rig-limits.schema'
import {
  apply,
  applyDir,
  lerp3,
  type M,
  matq,
  mul3,
  type Q,
  qmat,
  type R3,
  rotationOf,
  scale,
  sub,
  transpose3,
  type V3,
} from '../math/math'
import { at, clonePose, fk, J, JOINTS, type Pose, type Skeleton } from '../rig/rig'
import { defaultPole, LIMB_IDS, LIMBS, solveLimb } from './limbs'
import { clampJoints, jointLimits } from './limits'
import { angleBetween, degrees, eulerDegrees, slerp } from './rotation'
import type { EffectorId, LimbId, Reach, SolveReport, Space, Targets } from './targets'
import { pelvisInRoot, placePelvis, turnChest, turnHead } from './torso'

/** A position is reached within this many figure units, a rotation within this many degrees. */
const POSITION_TOLERANCE = 1e-6
const ROTATION_TOLERANCE = 1e-6

export interface Solved {
  readonly pose: Pose
  readonly world: M[]
  readonly report: SolveReport
}

/** The torso's limited joints, clamped once the hips, chest and head have turned. */
const TORSO = [J.spine, J.chest, J.neck, J.head]

const spaceOf = (world: readonly M[], space: Space | undefined): M =>
  at(world, space === 'chest' ? J.chest : J.root)
const origin: V3 = [0, 0, 0]
const turnOf = (m: M): Q => matq(rotationOf(m))

/** What a limb was asked for: a world position and, or, a world turn of its end. */
interface LimbGoal {
  readonly target?: V3
  readonly turn?: R3
}

/** The goal of one limb from its pin, its effector, or (feet, when the hips moved) its base place. */
function limbGoal(
  limb: LimbId,
  targets: Targets,
  world: readonly M[],
  baseWorld: readonly M[],
  hipsMoved: boolean,
  k: number,
): LimbGoal {
  const effector = targets.effectors[limb]
  const pin = targets.pins[limb]
  const end = LIMBS[limb].chain[2]
  const isFoot = LIMBS[limb].kind === 'foot'
  // Feet blend from where the base planted them; hands from where the body above has carried them.
  const from = isFoot ? baseWorld : world
  const weight = effector?.weight ?? 1
  const space = spaceOf(world, effector?.space)
  let turn: R3 | undefined
  if (effector?.rot) {
    const wanted = mul3(rotationOf(space), qmat(eulerDegrees(effector.rot)))
    turn = qmat(slerp(turnOf(at(from, end)), matq(wanted), weight))
  }
  let target: V3 | undefined
  if (pin) target = [...pin]
  else if (effector?.pos)
    target = lerp3(apply(at(from, end), origin), apply(space, scale([...effector.pos], k)), weight)
  else if (isFoot && hipsMoved) target = apply(at(baseWorld, end), origin)
  // A foot that re-solves keeps its base world turn, as the source's planted `footTurn`.
  if (target && !turn && isFoot) turn = rotationOf(at(baseWorld, end))
  return { ...(target ? { target } : {}), ...(turn ? { turn } : {}) }
}

/** The worst angle in degrees between the turns `wanted` asked for and the ones the pose ended with. */
function turnError(pose: Pose, wanted: ReadonlyMap<number, Q>): number {
  let worst = 0
  for (const [joint, turn] of wanted)
    worst = Math.max(worst, degrees(angleBetween(at(pose.rot, joint), turn)))
  return worst
}

export function solve(skeleton: Skeleton, base: Pose, targets: Targets, limits: RigLimits): Solved {
  const k = skeleton.genes.height / 1.62
  const pose = clonePose(base)
  const baseWorld = fk(skeleton, base)
  const reached: Partial<Record<EffectorId | 'aim', Reach>> = {}
  const table = jointLimits(limits)
  const limited = new Set<number>()

  // The hips, the chest and the head: local turns.
  const { pelvis, chest, head } = targets.effectors
  const pelvisTurn = pelvis ? placePelvis(skeleton, pose, pelvis, k) : new Map<number, Q>()
  const chestTurn = chest ? turnChest(pose, chest) : new Map<number, Q>()
  const headTurn = head ? turnHead(pose, head) : new Map<number, Q>()
  clampJoints(pose, TORSO, table, limited)
  let world = fk(skeleton, pose)

  // The limbs, each from the world the ones before it left.
  const limbTargets = new Map<LimbId, V3>()
  for (const limb of LIMB_IDS) {
    const goal = limbGoal(limb, targets, world, baseWorld, pelvis !== undefined, k)
    const [root, middle, end] = LIMBS[limb].chain
    if (goal.target) {
      const poleTarget = targets.poles[LIMBS[limb].pole]
      const pole = poleTarget
        ? applyDir(spaceOf(world, poleTarget.space), [...poleTarget.dir])
        : defaultPole(limb, at(world, J.root))
      solveLimb(skeleton, pose, world, limb, goal.target, pole, goal.turn)
      limbTargets.set(limb, goal.target)
    } else if (goal.turn) {
      // A turn without a position: the end turns in place.
      pose.rot[end] = matq(mul3(transpose3(rotationOf(at(world, middle))), goal.turn))
    }
    // Every limb is clamped, solved or not: a base pose past a limit is clamped too.
    if (clampJoints(pose, [root, middle], table, limited) || goal.target || goal.turn)
      world = fk(skeleton, pose)
  }

  // The report, from the final pose.
  for (const [limb, target] of limbTargets) {
    const error = Math.hypot(...sub(apply(at(world, LIMBS[limb].chain[2]), origin), target)) / k
    reached[limb] = { ok: error <= POSITION_TOLERANCE, error }
  }
  if (pelvis) {
    const error = pelvis.pos
      ? Math.hypot(
          ...sub(
            pelvisInRoot(skeleton, pose),
            lerp3(pelvisInRoot(skeleton, base), scale([...pelvis.pos], k), pelvis.weight ?? 1),
          ),
        ) / k
      : turnError(pose, pelvisTurn)
    reached.pelvis = { ok: error <= (pelvis.pos ? POSITION_TOLERANCE : ROTATION_TOLERANCE), error }
  }
  for (const [id, wanted] of [
    ['chest', chest ? chestTurn : undefined],
    ['head', head ? headTurn : undefined],
  ] as const) {
    if (!wanted) continue
    const error = turnError(pose, wanted)
    reached[id] = { ok: error <= ROTATION_TOLERANCE, error }
  }
  const report = { reached, limited: [...limited].sort((a, b) => a - b).map((joint) => at(JOINTS, joint)) }
  return { pose, world, report }
}
