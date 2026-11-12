// biome-ignore-all lint/style/noNonNullAssertion: the compiler needs these assertions until task 24 of the builders-fold plan (the strict flags) replaces each with a check
import { fk, J, restPose, type Side, type Skeleton, twoBoneIK } from '../body/rig'
import { add, apply, applyDir, euler, invertRigid, lerp3, position, qmat, TAU, type V3 } from '../math/math'
import { applyHold, base, placeHems, sideBend } from './motion-gait'
import { sideSign, standHolds } from './motion-stand'
import type { Evaluated, Gait, MotionState } from './motion-types'

export { applyHold, base, placeHems } from './motion-gait'
export { clearance, openings, place, relaxed, standHolds } from './motion-stand'
export type {
  ActionId,
  Anchor,
  AnchorKind,
  Evaluated,
  Gait,
  HandPlace,
  Hang,
  Hold,
  MotionState,
  Stand,
  Surface,
} from './motion-types'
export { CHAIN } from './motion-types'

// ─── Seated: a chair, a desk, a sofa ───
/**
 * A seated stand (library/seats.json): the hips on a seat `height` off the floor (m), the thighs forward over it, the
 * knees `knees` apart past the hips and the feet planted `feet` forward of under the knees (m at k 1; back tucks them
 * under the seat). The back leans `lean` forward from the hips (rad) or `slump`s (0–1: the pelvis rolls back and slides
 * forward on the seat, the spine rounds, the chest sinks), turned and rolled; the head on it (as a Stand's), its chin
 * kept level to whatever the chest leans, so the eyes stay on what is ahead. Each hand: in the lap (on the near thigh, by
 * the knee), on a desk at `to` (root space: x out from the middle, y up, z forward, m), hanging, or tapping (`type`, its
 * bob in m) as a typist's do.
 */
export interface Seat {
  about?: string
  height: number
  knees?: number
  feet?: number
  lean?: number
  slump?: number
  turn?: number
  roll?: number
  head?: [yaw: number, roll: number, pitch: number]
  hands?: Partial<Record<Side, SeatHand>>
  /** Typing: each hand on its desk point bobs this far (m), the two out of step. */
  type?: number
}
export type SeatHand = 'lap' | 'hang' | { to: V3; aim?: [fingers: V3, palm: V3] }
/** The thigh's flesh under the hip joint on a seat (m at k 1): the hip rides this far over the seat. */
export const SIT = 0.07
/**
 * A seated pose at time t (s): breath, and the typing hands' bob. `lookUp` the sprite cheat's tip toward the camera (as
 * MotionState's), `view` the camera's bearing on the figure. The hems ride the ankles (placeHems).
 */
export function seated(
  s: Skeleton,
  gait: Gait,
  seat: Seat,
  t = 0,
  o: { lookUp?: number; view?: number } = {},
): Evaluated {
  const g = s.genes,
    pose = restPose(),
    k = g.height / 1.62,
    slump = seat.slump ?? 0,
    lean = seat.lean ?? 0
  const breath = gait.breath * Math.sin((TAU * t) / gait.breathPeriod),
    { world: sideRoll, local: sideLocal } = sideBend(g)
  // The hips: down onto the seat, rolled back and slid forward by the slump.
  pose.shift[J.pelvis] = [0, seat.height + SIT * k - s.hipY - 0.03 * k * slump, 0.09 * k * slump]
  pose.rot[J.pelvis] = euler(-0.35 * slump, (seat.turn ?? 0) * 0.3, (seat.roll ?? 0) * 0.3)
  // The back: forward from the hips by the lean, the slump rounding it (the pelvis's roll back taken up by the spine
  // only in part, so the chest sinks behind the hips).
  pose.rot[J.spine] = euler(
    lean * 0.45 + 0.2 * slump + g.posture * 0.3,
    (seat.turn ?? 0) * 0.35,
    (seat.roll ?? 0) * 0.35 + sideRoll - sideLocal,
  )
  pose.rot[J.chest] = euler(
    lean * 0.55 + 0.3 * slump + g.posture * 0.7 - breath,
    (seat.turn ?? 0) * 0.35,
    (seat.roll ?? 0) * 0.35 + sideLocal,
  )
  // The head: the chest's pitch taken back so the face looks ahead, then the seat's own nod and turn.
  const toward = Math.max(0, Math.cos(o.view ?? 0)),
    [hy, hr, hp] = seat.head ?? [0, 0, 0]
  const pitch = g.headPitch - (lean + 0.15 * slump + g.posture) * 0.9 - (o.lookUp ?? 0) * toward + hp
  pose.rot[J.neck] = euler(
    pitch * 0.4 + 0.55 * g.hunch,
    -(seat.turn ?? 0) * 0.5 + hy * 0.4,
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
  const rootM = world[J.root],
    toRoot = invertRigid(rootM),
    forward = applyDir(rootM, [0, 0, 1])
  for (const side of ['L', 'R'] as const) {
    const x = sideSign(side),
      hip = apply(toRoot, position(world[J[`thigh.${side}`]]))
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
    const h = seat.hands?.[side] ?? 'lap',
      x = sideSign(side)
    if (h === 'hang') continue
    let hand: V3, aim: [V3, V3]
    if (h === 'lap') {
      const hip = apply(toRoot, position(world[J[`thigh.${side}`]])),
        knee = apply(toRoot, position(world[J[`shin.${side}`]]))
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
  placeHems(s, out.pose, out.world, true)
  return { pose: out.pose, world: fk(s, out.pose) }
}
/** The pose: the base, then a stand's placed hands (on the body's own surface unless placed already), then the item's hold. */
export function evaluate(s: Skeleton, gait: Gait, st: MotionState): Evaluated {
  let out = base(s, gait, st)
  const standing = !st.moving && !(st.shuffle > 0)
  for (const hold of standing ? (st.holds ?? (st.stand ? standHolds(s, st.stand) : [])) : [])
    out = applyHold(s, out, hold)
  return st.hold ? applyHold(s, out, st.hold) : out
}
