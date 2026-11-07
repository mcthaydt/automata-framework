// The legs: each foot on its path through the walk or the shuffle, or set by the stand; the hips riding on the
// planted legs; two-bone IK from each hip to its ankle, the foot turned and pitched by its roll.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/motion.ts at a1f7246 (`base`'s legs
// section), its formulas and their order. Changed for AF: no flinch step-back (a clip in M3.6); the walking
// feet come from `footOn`, which runs them along `moveDir` (gait-path.ts); a foot's lead over its hip and the
// hip's reach across to its foot are measured along the line of travel and the feet's own track, so a strafe
// rides the planted feet as a forward walk does.

import {
  apply,
  applyDir,
  euler,
  invertRigid,
  type M,
  position,
  qmat,
  qmul,
  type V3,
} from '../../../shared/math/math.ts'
import { at, fk, J, type Pose, type Side, type Skeleton } from '../body/rig.ts'
import { twoBoneIK } from '../body/two-bone-ik.ts'
import type { Gait } from '../content/gait.schema.ts'
import type { Stand } from '../content/stand.schema.ts'
import { type FootTarget, footOn, footPath, halfTrack, sideSign, type Travel } from './gait-path.ts'
import type { MotionState } from './motion-state.ts'

/** The least the head rises and falls over a step (m): a texel at the brand kit's density (36.9 a metre), so no
 * walk glides. */
export const BOB = 0.03
/** The leading knee's least bend as its heel strikes, as the hips' drop over a straight leg (m at k 1): about 14°. */
const SOFT = 0.006

interface LegsContext {
  /** The stand when standing (not walking, not mid-turn), else null. */
  readonly stand: Stand | null
  /** The cycle's phase as it plays (reversed backing away), or the shuffle's. */
  readonly phase: number
  /** The share of the bob the neck takes up walking. */
  readonly headLevel: number
  /** The way the walk plays for its direction of travel (gait-path.ts). */
  readonly way: Travel
}
/** A foot target whose pitch the hips' ride may lower. */
type Foot = Omit<FootTarget, 'pitch'> & { pitch: number }

/** Poses the legs into `pose` (and the pelvis's height), from `world`, the FK of the pose so far. */
export function legs(
  s: Skeleton,
  gait: Gait,
  st: MotionState,
  pose: Pose,
  world: M[],
  ctx: LegsContext,
): void {
  const g = s.genes
  const k = g.height / 1.62
  const walking = st.moving
  const shuffling = !walking && st.shuffle > 0
  const { stand, phase, headLevel, way } = ctx
  const w = stand ? sideSign(stand.weight) : 0
  const pelvis = at(pose.shift, J.pelvis)
  const rootM = at(world, J.root)
  const forwardWorld = applyDir(rootM, [0, 0, 1])
  if (stand) {
    // The weight leg runs straight from its hip to its foot, drawn in under the body: the hips sink as far as that needs.
    const hipW = position(at(world, J[`thigh.${stand.weight}`]))
    const foot = apply(rootM, [w * g.hips * (1 - (stand.under ?? 0.25)), g.ankle, 0])
    const L = (s.thigh + s.shin) * 0.9995
    const dx = hipW[0] - foot[0]
    const dz = hipW[2] - foot[2]
    pelvis[1] -= hipW[1] - foot[1] - Math.sqrt(Math.max(0, L * L - dx * dx - dz * dz))
    world = fk(s, pose)
  }
  const stride = (walking ? gait.stride : shuffling ? 0.12 : 0) * k
  const lift = (walking ? gait.lift : shuffling ? 0.035 : 0) * k
  // The feet: a stand's, or each on its path (root space). `pitch` toes down; `planted` on the floor mid-walk.
  const L = (s.thigh + s.shin) * 0.996
  const heelReach = 0.2 * g.foot
  const toeReach = 0.62 * g.foot
  const feet = (['L', 'R'] as const).map((side): Foot => {
    const x = sideSign(side)
    if (stand) {
      // The weight foot under the body, the free one forward and out, its toes turned out and its heel a
      // little up, so its knee comes soft.
      const free = x !== w
      const [fwd = 0, out = 0, splay = 0, heel = 0] = stand.free
      const under = stand.under ?? 0.25
      const up = free ? Math.max(0, Math.sin(heel)) * toeReach : 0
      const target: V3 = free
        ? [x * (g.hips * (1 - under) + out * k), g.ankle + up, fwd * k]
        : [x * g.hips * (1 - under), g.ankle, 0]
      return {
        side,
        at: target,
        pitch: free ? heel : 0,
        turn: x * (free ? splay : (stand.splay ?? 0.1)),
        planted: false,
      }
    }
    if (walking && stride) return { ...footOn(gait, s, side, st.phase, way) }
    // Walking, the feet fall toward one line under the body (`track`); standing, they keep under the hips.
    const [z, y, pitch] = stride ? footPath(phase + (side === 'L' ? 0 : 0.5), gait, stride, lift) : [0, 0, 0]
    const target: V3 = [x * g.hips * (walking ? gait.track : Math.max(gait.track, 0.75)), g.ankle + y, z]
    return { side, at: target, pitch, turn: 0, planted: false }
  })
  // On its heel the ankle rides up the heel's reach (and on its toes, the toes'), so the foot pivots on the floor.
  const pivot = (pitch: number) =>
    Math.max(0, Math.sin(pitch)) * toeReach + Math.max(0, -Math.sin(pitch)) * heelReach
  // This side's hip (root space), and how high it stands over an ankle at `at` raised `up` with the leg straight.
  const toRoot = invertRigid(rootM)
  const hipOf = (side: Side) => apply(toRoot, position(at(world, J[`thigh.${side}`])))
  const tall = (side: Side, target: V3, up: number) => {
    const hip = hipOf(side)
    return (
      target[1] +
      up +
      Math.sqrt(Math.max(0, L * L - (hip[0] - target[0]) ** 2 - (hip[2] - target[2]) ** 2)) -
      hip[1]
    )
  }
  // How far a foot is ahead of its hip along the line the feet run (the source's z: forward).
  const ahead = (foot: V3, hip: V3) => (foot[0] - hip[0]) * way.sin + (foot[2] - hip[2]) * way.cos
  if (stride && walking) {
    // The hips ride on the planted legs: no higher than lets every planted foot reach the floor (a pushing one
    // flat), and, over a heel just struck ahead, no lower than its knee's softest (SOFT), so the strike reads
    // as a step and not a lunge. But with both feet down they dip at least BOB (and what the neck takes up)
    // under their height mid-stance, so no walk glides: that height the stance leg's, straight from a hip the
    // roll lifts to a foot drawn in toward the line (`track`).
    const planted = feet.filter((f) => f.planted)
    const soft = SOFT * k
    const room = Math.min(
      Infinity,
      ...planted.map((f) => tall(f.side, f.at, f.pitch > 0 ? 0 : pivot(f.pitch))),
    )
    const want = Math.max(
      0,
      ...planted
        .filter((f) => f.pitch <= 0 && ahead(f.at, hipOf(f.side)) > 0)
        .map((f) => tall(f.side, f.at, pivot(f.pitch)) - soft),
    )
    const top = -Math.max(
      gait.crouch,
      (Math.abs(g.hips - halfTrack(gait, s, way)) + gait.sway) ** 2 / (2 * L) +
        g.hips * Math.sin(gait.hipRoll) +
        0.004 * L,
    )
    const dip = top - (1.1 * BOB) / (1 - headLevel)
    let dy = Number.isFinite(room) ? Math.min(room, want) : 0
    if (planted.length > 1) dy = Math.min(dy, dip - pelvis[1])
    if (dy) {
      pelvis[1] += dy
      at(pose.shift, J.neck)[1] -= dy * (walking ? headLevel : 0)
      world = fk(s, pose)
    }
    // A foot pushing off lifts its heel only so far as its leg still reaches straight: the trailing knee stays long.
    for (const f of feet)
      if (f.planted && f.pitch > 0)
        f.pitch = Math.min(f.pitch, Math.asin(Math.min(1, Math.max(0, tall(f.side, f.at, 0)) / toeReach)))
  }
  for (const f of feet) {
    const ankle = apply(rootM, [f.at[0], f.at[1] + (stand ? 0 : pivot(f.pitch)), f.at[2]])
    // Feet point where the body does (a stand's turned out), pitched by their roll.
    const footTurn = qmat(qmul(euler(0, st.yaw + f.turn, 0), euler(f.pitch, 0, 0)))
    twoBoneIK(
      s,
      pose,
      world,
      J[`thigh.${f.side}`],
      J[`shin.${f.side}`],
      J[`foot.${f.side}`],
      ankle,
      forwardWorld,
      1,
      footTurn,
    )
  }
}
