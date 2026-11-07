// The hems (rig.ts `hemL`, `hemR`): each upright on the floor between its ankle and the plumb under its hip
// while the foot is planted, riding up with the ankle as the heel peels off and following it through the
// swing, so a wide hem always covers its shoe's collar and never tips with the shin. Written as each joint's
// turn and shift on its shin.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/motion.ts at a1f7246 (`placeHems`),
// its formulas and their order. Changed for AF: walking, fore and aft is along the line of travel (`moveDir`).

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
  type V3,
} from '../../../shared/math/math.ts'
import { at, J, type Pose, type Skeleton } from '../body/rig.ts'

/** A planted foot ahead of its hip has its hem hang PLANT of the way from the plumb under the hip to the ankle,
 * fore and aft (across, it keeps to the ankle), so the toe steps out from under the cloth; a foot BEHIND (m at
 * k 1) its hip, or lifted LIFT off the floor, has it follow the ankle all the way, so the heel peels up inside
 * the hem. */
const PLANT = 0.5
const LIFT = 0.03
const BEHIND = 0.06

/**
 * Writes the hems' turn and shift into `pose`, from `world` (the pose's FK with the legs placed). "Fore and
 * aft" is along `line` (root space x, z; the line the feet run walking, M3.5c), forward when left out. `follow` (0 the
 * hip's plumb, 1 the ankle) fixes how far the hem follows the ankle, for a figure whose knee is not over its foot: a
 * seated one's hem rides the ankle all the way (1).
 */
export function placeHems(
  s: Skeleton,
  pose: Pose,
  world: readonly M[],
  line?: readonly [number, number],
  follow?: number,
): void {
  const g = s.genes
  const k = g.height / 1.62
  const rootM = at(world, J.root)
  const toRoot = invertRigid(rootM)
  for (const side of ['L', 'R'] as const) {
    const hem = J[`hem${side}`]
    const ankle = apply(toRoot, position(at(world, J[`foot.${side}`])))
    const hip = apply(toRoot, position(at(world, J[`thigh.${side}`])))
    const lift = Math.max(0, ankle[1] - g.ankle)
    const behind = line ? (hip[0] - ankle[0]) * line[0] + (hip[2] - ankle[2]) * line[1] : hip[2] - ankle[2]
    const along = follow ?? lerp(PLANT, 1, Math.max(smooth(lift / (LIFT * k)), smooth(behind / (BEHIND * k))))
    // Along the line the hem hangs `along` of the way from the hip's plumb to the ankle; across it, at the ankle.
    const back = line ? (1 - along) * behind : 0
    const place: V3 = line
      ? [ankle[0] + back * line[0], g.ankle + lift, ankle[2] + back * line[1]]
      : [ankle[0], g.ankle + lift, lerp(hip[2], ankle[2], along)]
    const local = mmul(invertRigid(at(world, J[`shin.${side}`])), mmul(rootM, compose(IDENTITY_Q, place)))
    pose.rot[hem] = matq(rotationOf(local))
    pose.shift[hem] = sub(position(local), at(s.offset, hem))
  }
}
