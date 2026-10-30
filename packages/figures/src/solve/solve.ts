// solve(): turns the rig's handles (targets.ts) into joint rotations (M3 spec §4.4.2). Pure: a function of its
// arguments only, no clock, no Math.random; `base` is never written.
//
// Order (§4.4.5 step 5): the hips, the chest and the head (torso.ts), clamped by the limits; the head and chest
// aims (aim.ts), which clamp as they turn; then each limb (limbs.ts), the feet re-solving onto their base places
// when the hips moved, a pin outranking a hand aim and a hand aim outranking an effector position, each limb
// clamped after its solve; then the report, from the final pose.

import type { RigLimits } from '../library/rig-limits.schema'
import {
  add,
  apply,
  applyDir,
  IDENTITY_Q,
  length,
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
import { aimError, aimTorso, handAimError, handAimTarget } from './aim'
import { chainWorld } from './chain-world'
import { defaultPole, LIMB_IDS, LIMBS, solveLimb } from './limbs'
import { clampJoints, jointLimits } from './limits'
import { angleBetween, degrees, eulerDegrees, slerp } from './rotation'
import type { AimTarget, EffectorId, LimbId, Reach, SolveReport, Space, Targets } from './targets'
import { pelvisInRoot, placePelvis, turnChest, turnHead } from './torso'

/** A position is reached within this many figure units, a rotation within this many degrees. */
const POSITION_TOLERANCE = 1e-6
const ROTATION_TOLERANCE = 1e-6
/** An aim is on its point within this many degrees (I-e). */
const AIM_TOLERANCE = 0.5

export interface Solved {
  readonly pose: Pose
  readonly world: M[]
  readonly report: SolveReport
}

/** The torso's limited joints, clamped once the hips, chest and head have turned. */
const TORSO = [J.spine, J.chest, J.neck, J.head]

const isTorsoAim = (aim: AimTarget): aim is AimTarget & { readonly part: 'head' | 'chest' } =>
  aim.part === 'head' || aim.part === 'chest'

/** The length of the bone ending at `joint`, as the pose has it. */
const limbLength = (s: Skeleton, pose: Pose, joint: number): number =>
  length(add(at(s.offset, joint), at(pose.shift, joint)))

const spaceOf = (world: readonly M[], space: Space | undefined): M =>
  at(world, space === 'chest' ? J.chest : J.root)
const origin: V3 = [0, 0, 0]
const turnOf = (m: M): Q => matq(rotationOf(m))

/** What a limb was asked for: a world position and, or, a world turn of its end; `aim` when a hand aim set
 * the position (the hand then straightens along the forearm). */
interface LimbGoal {
  readonly target?: V3
  readonly turn?: R3
  readonly aim?: AimTarget
}

/** The goal of one limb from its pin, its effector, or (feet, when the hips moved) its base place. */
function limbGoal(
  skeleton: Skeleton,
  pose: Pose,
  limb: LimbId,
  targets: Targets,
  world: readonly M[],
  baseAt: (joint: number) => M,
  hipsMoved: boolean,
  k: number,
): LimbGoal {
  const effector = targets.effectors[limb]
  const pin = targets.pins[limb]
  const end = LIMBS[limb].chain[2]
  const isFoot = LIMBS[limb].kind === 'foot'
  // Feet blend from where the base planted them; hands from where the body above has carried them.
  const fromEnd = isFoot ? baseAt(end) : at(world, end)
  const weight = effector?.weight ?? 1
  const space = spaceOf(world, effector?.space)
  let turn: R3 | undefined
  if (effector?.rot) {
    const wanted = mul3(rotationOf(space), qmat(eulerDegrees(effector.rot)))
    turn = qmat(slerp(turnOf(fromEnd), matq(wanted), weight))
  }
  const aim = targets.aim.find((a) => a.part === limb)
  let target: V3 | undefined
  if (pin) target = [...pin]
  else if (aim) {
    const [root, middle] = LIMBS[limb].chain
    const reach = limbLength(skeleton, pose, middle) + limbLength(skeleton, pose, end)
    const aimed = handAimTarget(world, root, reach, [...aim.at])
    target = lerp3(apply(at(world, end), origin), aimed, aim.weight ?? 1)
  } else if (effector?.pos)
    target = lerp3(apply(fromEnd, origin), apply(space, scale([...effector.pos], k)), weight)
  else if (isFoot && hipsMoved) target = apply(baseAt(end), origin)
  // A foot that re-solves keeps its base world turn, as the source's planted `footTurn`.
  if (target && !turn && isFoot) turn = rotationOf(baseAt(end))
  return {
    ...(target ? { target } : {}),
    ...(turn ? { turn } : {}),
    ...(aim && !pin ? { aim } : {}),
  }
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
  // The base pose's world, walked only for the joints a re-solved foot needs.
  const baseCache = new Map<number, M>()
  const baseAt = (joint: number): M => {
    let m = baseCache.get(joint)
    if (!m) {
      m = at(chainWorld(skeleton, base, joint), joint)
      baseCache.set(joint, m)
    }
    return m
  }
  const reached: Partial<Record<EffectorId | 'aim', Reach>> = {}
  const table = jointLimits(limits)
  const limited = new Set<number>()

  // The hips, the chest and the head: local turns.
  const { pelvis, chest, head } = targets.effectors
  const pelvisTurn = pelvis ? placePelvis(skeleton, pose, pelvis, k) : new Map<number, Q>()
  const chestTurn = chest ? turnChest(pose, chest) : new Map<number, Q>()
  const torsoAims = targets.aim.filter(isTorsoAim)
  // A head aim takes a look-at instead of the head's turn.
  const headTurn =
    head && !torsoAims.some((a) => a.part === 'head') ? turnHead(pose, head) : new Map<number, Q>()
  clampJoints(pose, TORSO, table, limited)
  // The chest and head handles are judged here, by how far the limits kept them; an aim then turns on top.
  for (const [id, wanted] of [
    ['chest', chest ? chestTurn : undefined],
    ['head', head ? headTurn : undefined],
  ] as const) {
    if (!wanted) continue
    const error = turnError(pose, wanted)
    reached[id] = { ok: error <= ROTATION_TOLERANCE, error }
  }
  for (const aim of torsoAims) for (const joint of aimTorso(skeleton, pose, aim, table)) limited.add(joint)
  const torsoWorld = fk(skeleton, pose)

  // The limbs. No limb is another's ancestor (legs hang from the pelvis, arms from the clavicles), so every
  // limb solves from the one world the torso left, and the pose is walked once more at the end.
  const limbTargets = new Map<LimbId, V3>()
  const handAims: { aim: AimTarget; root: number; end: number }[] = []
  for (const limb of LIMB_IDS) {
    const goal = limbGoal(skeleton, pose, limb, targets, torsoWorld, baseAt, pelvis !== undefined, k)
    const [root, middle, end] = LIMBS[limb].chain
    if (goal.target) {
      const poleTarget = targets.poles[LIMBS[limb].pole]
      const pole = poleTarget
        ? applyDir(spaceOf(torsoWorld, poleTarget.space), [...poleTarget.dir])
        : defaultPole(limb, at(torsoWorld, J.root))
      solveLimb(skeleton, pose, torsoWorld, limb, goal.target, pole, goal.turn)
      if (goal.aim) {
        // The hand carries on the forearm's line, so it points where the arm does.
        pose.rot[end] = slerp(at(pose.rot, end), IDENTITY_Q, goal.aim.weight ?? 1)
        handAims.push({ aim: goal.aim, root, end })
      } else limbTargets.set(limb, goal.target)
    } else if (goal.turn) {
      // A turn without a position: the end turns in place.
      pose.rot[end] = matq(mul3(transpose3(rotationOf(at(torsoWorld, middle))), goal.turn))
    }
    // Every limb is clamped, solved or not: a base pose past a limit is clamped too.
    clampJoints(pose, [root, middle], table, limited)
  }
  const world = fk(skeleton, pose)

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
  if (torsoAims.length > 0 || handAims.length > 0) {
    const errors = [
      ...torsoAims.map((aim) => aimError(world, aim.part === 'head' ? J.head : J.chest, [...aim.at])),
      ...handAims.map(({ aim, root, end }) => handAimError(world, root, end, [...aim.at])),
    ]
    const error = degrees(Math.max(...errors))
    reached.aim = { ok: error <= AIM_TOLERANCE, error }
  }
  const report = { reached, limited: [...limited].sort((a, b) => a - b).map((joint) => at(JOINTS, joint)) }
  return { pose, world, report }
}
