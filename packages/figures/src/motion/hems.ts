// The hems (rig.ts `hemL`, `hemR`): each upright on the floor between its ankle and the plumb under its hip
// while the foot is planted, riding up with the ankle as the heel peels off and following it through the
// swing, so a wide hem always covers its shoe's collar and never tips with the shin. Written as each joint's
// turn and shift on its shin.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/motion.ts at a1f7246 (`placeHems`),
// its formulas and their order.

import {
  apply,
  compose,
  IDENTITY_Q,
  invertRigid,
  lerp,
  type M,
  matq,
  mmul,
  position,
  rotationOf,
  smooth,
  sub,
} from '../math/math'
import { at, J, type Pose, type Skeleton } from '../rig/rig'

/** A planted foot ahead of its hip has its hem hang PLANT of the way from the plumb under the hip to the ankle,
 * fore and aft (across, it keeps to the ankle), so the toe steps out from under the cloth; a foot BEHIND (m at
 * k 1) its hip, or lifted LIFT off the floor, has it follow the ankle all the way, so the heel peels up inside
 * the hem. */
const PLANT = 0.5
const LIFT = 0.03
const BEHIND = 0.06

/** Writes the hems' turn and shift into `pose`, from `world` (the pose's FK with the legs placed). */
export function placeHems(s: Skeleton, pose: Pose, world: readonly M[]): void {
  const g = s.genes
  const k = g.height / 1.62
  const rootM = at(world, J.root)
  const toRoot = invertRigid(rootM)
  for (const side of ['L', 'R'] as const) {
    const hem = J[`hem${side}`]
    const ankle = apply(toRoot, position(at(world, J[`foot.${side}`])))
    const hip = apply(toRoot, position(at(world, J[`thigh.${side}`])))
    const lift = Math.max(0, ankle[1] - g.ankle)
    const follow = lerp(
      PLANT,
      1,
      Math.max(smooth(lift / (LIFT * k)), smooth((hip[2] - ankle[2]) / (BEHIND * k))),
    )
    const local = mmul(
      invertRigid(at(world, J[`shin.${side}`])),
      mmul(rootM, compose(IDENTITY_Q, [ankle[0], g.ankle + lift, lerp(hip[2], ankle[2], follow)])),
    )
    pose.rot[hem] = matq(rotationOf(local))
    pose.shift[hem] = sub(position(local), at(s.offset, hem))
  }
}
