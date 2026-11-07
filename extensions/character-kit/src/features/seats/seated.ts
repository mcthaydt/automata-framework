// A seated pose: a chair, a desk, a sofa. The hips drop onto a seat of some height, the back leans or slumps, the head
// keeps the face to what is ahead, the feet plant forward of the knees, and each hand goes to the lap, hangs, or taps a
// desk (a hold laid over the pose, as a placed hand is). The hems ride the ankles.
//
// Ported from FigureBuilder (mcthaydt/FigureBuilder) src/features/motion/motion.ts at 025ffb4 (`Seat`'s `seated`,
// `SIT`), with AF's strict types; the formulas and their order are the source's. Changed for AF: no sprite cheats
// (`lookUp`, `view`), as base.ts has none; the pose is a function of the seat and `t` alone.

import {
  add,
  apply,
  applyDir,
  applyHold,
  type Evaluated,
  euler,
  fk,
  type Gait,
  invertRigid,
  J,
  lerp3,
  placeHems,
  position,
  qmat,
  restPose,
  type Skeleton,
  sideBend,
  sideSign,
  TAU,
  twoBoneIK,
  type V3,
} from '@automata/3d/figures'
import { at } from '@automata/3d/figures-kit'
import type { Seat } from './seat.schema.ts'

/** The thigh's flesh under the hip joint on a seat (m at scale 1): the hip rides this far over the seat. */
export const SIT = 0.07

/** A seated pose at time `t` (s): breath, and the typing hands' bob. */
export function seated(s: Skeleton, gait: Gait, seat: Seat, t = 0): Evaluated {
  const g = s.genes
  const pose = restPose()
  const k = g.height / 1.62
  const slump = seat.slump ?? 0
  const lean = seat.lean ?? 0
  const turn = seat.turn ?? 0
  const roll = seat.roll ?? 0
  const breath = gait.breath * Math.sin((TAU * t) / gait.breathPeriod)
  const { world: sideRoll, local: sideLocal } = sideBend(g)
  // The hips: down onto the seat, rolled back and slid forward by the slump.
  pose.shift[J.pelvis] = [0, seat.height + SIT * k - s.hipY - 0.03 * k * slump, 0.09 * k * slump]
  pose.rot[J.pelvis] = euler(-0.35 * slump, turn * 0.3, roll * 0.3)
  // The back: forward from the hips by the lean, the slump rounding it (the pelvis's roll back taken up by the spine
  // only in part, so the chest sinks behind the hips).
  pose.rot[J.spine] = euler(
    lean * 0.45 + 0.2 * slump + g.posture * 0.3,
    turn * 0.35,
    roll * 0.35 + sideRoll - sideLocal,
  )
  pose.rot[J.chest] = euler(
    lean * 0.55 + 0.3 * slump + g.posture * 0.7 - breath,
    turn * 0.35,
    roll * 0.35 + sideLocal,
  )
  // The head: the chest's pitch taken back so the face looks ahead, then the seat's own nod and turn.
  const [hy = 0, hr = 0, hp = 0] = seat.head ?? []
  const pitch = g.headPitch - (lean + 0.15 * slump + g.posture) * 0.9 + hp
  pose.rot[J.neck] = euler(
    pitch * 0.4 + 0.55 * g.hunch,
    -turn * 0.5 + hy * 0.4,
    (g.headTilt + hr - sideRoll) * 0.4,
  )
  pose.rot[J.head] = euler(pitch * 0.6 - 0.55 * g.hunch, hy * 0.6, (g.headTilt + hr - sideRoll) * 0.6)
  // The arms hang until placed; the clavicles breathe.
  for (const side of ['L', 'R'] as const) {
    const x = sideSign(side)
    pose.rot[J[`clavicle.${side}`]] = euler(0, -x * 0.12 * g.hunch, x * (breath * 0.6 + 0.3 * g.hunch))
    pose.rot[J[`upperArm.${side}`]] = euler(-0.1, 0, x * (gait.armOut + 0.05) - sideRoll)
    pose.rot[J[`foreArm.${side}`]] = euler(-(gait.elbow + 0.15), 0, 0)
  }
  let world = fk(s, pose)
  // The legs: each foot planted forward of under its knee, the knee bent forward over it.
  const rootM = at(world, J.root)
  const toRoot = invertRigid(rootM)
  const forward = applyDir(rootM, [0, 0, 1])
  for (const side of ['L', 'R'] as const) {
    const x = sideSign(side)
    const hip = apply(toRoot, position(at(world, J[`thigh.${side}`])))
    const ankle = apply(rootM, [
      x * (g.hips + (seat.knees ?? 0.02) * k),
      g.ankle,
      hip[2] + s.thigh * 0.92 + (seat.feet ?? 0) * k,
    ])
    twoBoneIK(
      s,
      pose,
      world,
      J[`thigh.${side}`],
      J[`shin.${side}`],
      J[`foot.${side}`],
      ankle,
      add(forward, applyDir(rootM, [0, 0.6, 0])),
      1,
      qmat(euler(0, x * 0.12, 0)),
    )
    world = fk(s, pose)
  }
  // The hands, as holds in the root's space: on the lap by the knee, or on the desk (tapping).
  let out: Evaluated = { pose, world }
  for (const side of ['L', 'R'] as const) {
    const h = seat.hands?.[side] ?? 'lap'
    const x = sideSign(side)
    if (h === 'hang') continue
    let hand: V3
    let aim: readonly [V3, V3]
    if (h === 'lap') {
      const hip = apply(toRoot, position(at(world, J[`thigh.${side}`])))
      const knee = apply(toRoot, position(at(world, J[`shin.${side}`])))
      hand = add(lerp3(hip, knee, 0.72), [-x * 0.015 * k, 0.085 * k, 0])
      aim = [
        [x * -0.2, -0.25, 1],
        [0, -1, 0],
      ]
    } else {
      const bob = seat.type ? seat.type * Math.max(0, Math.sin(TAU * 3.5 * t + (side === 'L' ? 0 : 2.2))) : 0
      hand = [x * h.to[0], h.to[1] + bob, h.to[2]]
      aim = h.aim
        ? [
            [x * h.aim[0][0], h.aim[0][1], h.aim[0][2]],
            [x * h.aim[1][0], h.aim[1][1], h.aim[1][2]],
          ]
        : [
            [-x * 0.25, -0.35, 1],
            [0, -1, 0.1],
          ]
    }
    out = applyHold(s, out, { side, hand, turn: [0, 0, 0], pole: [x * 0.7, -0.5, -0.6], in: J.root, aim })
  }
  placeHems(s, out.pose, out.world, undefined, 1)
  return { pose: out.pose, world: fk(s, out.pose) }
}
