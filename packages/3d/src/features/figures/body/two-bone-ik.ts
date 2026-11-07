// Analytic two-bone IK, the one solver the source has: it drives both legs (foot paths) and the arms (a held
// item's grip, a hand target). M3.6a's `solve()` builds the effectors, poles and limits on it.
//
// Extracted from FigureBuilder (mcthaydt/FigureBuilder) src/render/figure/rig.ts (`twoBoneIK`) at a1f7246.
// Changed for AF: typed rotations (`R3`) and checked joint lookups; the steps and their order are the source's.

import {
  add,
  apply,
  basis,
  clamp,
  cross,
  dot,
  length,
  type M,
  matq,
  mul3,
  normalize,
  type R3,
  rotationOf,
  scale,
  sub,
  transpose3,
  type V3,
} from '../../../shared/math/math.ts'
import { at, PARENTS, type Pose, type Skeleton } from './rig.ts'

/**
 * Law-of-cosines IK on the chain a → b → c, so c lands on `target` (world), bending toward `pole` (a world
 * direction; knees forward, elbows back). `bend` is +1 when the joint's local +z faces the pole (legs) and −1
 * when it faces away (arms). Writes the local rotations of a and b into `pose`; `end` (a world rotation) sets
 * c's too. `world` must be current for a's parent.
 *
 * A target past the chain's reach (or closer than |l1 − l2|) is clamped to the reachable distance along the
 * same direction, so the limb extends fully toward it and no bone stretches. A pole parallel to the limb, or a
 * target on the limb's root, falls back to a fixed axis instead of producing NaN (the source's fallback).
 */
export function twoBoneIK(
  s: Skeleton,
  pose: Pose,
  world: readonly M[],
  a: number,
  b: number,
  c: number,
  target: V3,
  pole: V3,
  bend: 1 | -1,
  end?: R3,
): void {
  const parent = at(world, at(PARENTS, a))
  const pa = apply(parent, add(at(s.offset, a), at(pose.shift, a)))
  const l1 = length(add(at(s.offset, b), at(pose.shift, b))),
    l2 = length(add(at(s.offset, c), at(pose.shift, c)))
  const toTarget = sub(target, pa),
    d = clamp(length(toTarget), Math.abs(l1 - l2) + 1e-6, l1 + l2 - 1e-6)
  const dir = normalize(toTarget)
  let pn = sub(pole, scale(dir, dot(pole, dir)))
  if (length(pn) < 1e-6)
    pn = Math.abs(dir[1]) < 0.9 ? normalize(cross(dir, [0, 1, 0])) : normalize(cross(dir, [1, 0, 0]))
  pn = normalize(pn)
  const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1),
    sinA = Math.sqrt(1 - cosA * cosA)
  const pb = add(pa, scale(add(scale(dir, cosA), scale(pn, sinA)), l1))
  const pc = add(pa, scale(dir, d))
  const u = normalize(sub(pb, pa)),
    v = normalize(sub(pc, pb))
  const y1: V3 = scale(u, -1),
    z1 = normalize(sub(scale(pn, bend), scale(u, dot(scale(pn, bend), u)))),
    x1 = cross(y1, z1)
  const upper = basis(x1, y1, z1)
  const y2: V3 = scale(v, -1),
    z2 = cross(x1, y2),
    lower = basis(x1, y2, z2)
  pose.rot[a] = matq(mul3(transpose3(rotationOf(parent)), upper))
  pose.rot[b] = matq(mul3(transpose3(upper), lower))
  if (end) pose.rot[c] = matq(mul3(transpose3(lower), end))
}
