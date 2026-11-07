// Holds (M3 spec §4.4.1, §4.4.5 step 6): an item's grip, or a stand's placed hand, rewrites only its side's
// upper arm, forearm and hand, after everything else, so an item never changes the rest of the pose (F-b).
// M3.6's `evaluate` applies them only to an arm no active clip owns.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) at a1f7246: src/render/figure/motion.ts (`handTurn`,
// `applyHold`, and `evaluate`, here `evaluateMotion`) and src/render/figure/cast.ts (an item's `hold` from its
// measures, here `holdOf`), their formulas and their order.

import {
  apply,
  applyDir,
  basis,
  cross,
  dot,
  euler,
  type M,
  matq,
  mul3,
  normalize,
  qmat,
  qmul,
  type R3,
  rotationOf,
  scale,
  sub,
} from '../../../shared/math/math.ts'
import { at, clonePose, fk, J, type Side, type Skeleton } from '../body/rig.ts'
import { twoBoneIK } from '../body/two-bone-ik.ts'
import type { Gait } from '../content/gait.schema.ts'
import type { ItemDef } from '../content/item.schema.ts'
import { base } from './base.ts'
import type { ArmHold, Evaluated, MotionState } from './motion-state.ts'
import { standHolds } from './stands.ts'

/** An item's hold on this skeleton and hand: its measures summed (k, the shoulders, the arm), mirrored in x for the left. */
export function holdOf(item: ItemDef, s: Skeleton, side: Side): ArmHold {
  const x = side === 'L' ? 1 : -1
  const k = s.genes.height / 1.62
  const [hx, hy, hz] = item.hold.hand.map(
    (t) => (t.shoulders ?? 0) * s.genes.shoulders + (t.arms ?? 0) * s.genes.arms + (t.k ?? 0) * k,
  ) as [number, number, number]
  const [px, py, pz] = item.hold.pole
  return { side, hand: [x * hx, hy, hz], turn: [...item.hold.turn], pole: [x * px, py, pz] }
}

/** The hand's world turn for a hold in a joint's space `space`: its euler turn, or its aim (fingers along the
 * hand's −y, the palm on its inner side: −x for the left hand, +x for the right). */
function handTurn(space: M, hold: ArmHold): R3 {
  const r = rotationOf(space)
  if (!hold.aim) return qmat(qmul(matq(r), matq(qmat(euler(...hold.turn)))))
  const y = scale(normalize(hold.aim[0]), -1)
  const palm = normalize(hold.aim[1])
  const x0 = scale(palm, hold.side === 'L' ? -1 : 1)
  const x = normalize(sub(x0, scale(y, dot(x0, y))))
  const z = cross(x, y)
  return mul3(r, basis(x, y, z))
}

/** A hold: rewrites only its side's upper arm, forearm and hand, the hand in its joint's space (the chest's). */
export function applyHold(s: Skeleton, evaluated: Evaluated, hold: ArmHold): Evaluated {
  const pose = clonePose(evaluated.pose)
  const space = at(evaluated.world, hold.in ?? J.chest)
  const target = apply(space, hold.hand)
  twoBoneIK(
    s,
    pose,
    evaluated.world,
    J[`upperArm.${hold.side}`],
    J[`foreArm.${hold.side}`],
    J[`hand.${hold.side}`],
    target,
    applyDir(space, hold.pole),
    -1,
    handTurn(space, hold),
  )
  // A full FK again: the other joints come out equal because nothing upstream of them changed (F-b checks it).
  return { pose, world: fk(s, pose) }
}

/**
 * The pose: the base, then a stand's placed hands, then the item's hold. Placing a stand's hands casts rays
 * against the dressed surface (stands.ts), so a view places them once per outfit and stand (`standHolds` with
 * `Built.anchors` and the outfit's surface) and passes them in `holds`; with none, they are placed here, every
 * call, on the body's own openings.
 */
export function evaluateMotion(s: Skeleton, gait: Gait, st: MotionState): Evaluated {
  let out = base(s, gait, st)
  const standing = !st.moving && !(st.shuffle > 0)
  for (const hold of standing ? (st.holds ?? (st.stand ? standHolds(s, st.stand) : [])) : [])
    out = applyHold(s, out, hold)
  return st.hold ? applyHold(s, out, st.hold) : out
}
