// The limb handles (M3 spec §4.4.2): feet and hands on M3.5a's `twoBoneIK`, from the thigh or the upper arm,
// bending toward a pole. The default poles are the source's (FigureBuilder `motion.ts` at a1f7246): a knee
// points along the root's forward (`forwardWorld`), an elbow back, down and out (`[x·0.7, −0.5, −0.5]` in root
// space, x +1 on the left).

import { applyDir, type M, type R3, type V3 } from '../math/math'
import { J, type Pose, type Skeleton } from '../rig/rig'
import { twoBoneIK } from '../rig/two-bone-ik'
import type { LimbId, PoleId } from './targets'

export interface Limb {
  readonly chain: readonly [number, number, number]
  readonly pole: PoleId
  /** twoBoneIK's `bend`: +1 when the middle joint's local +z faces the pole (knees), −1 when away (elbows). */
  readonly bend: 1 | -1
  /** The default pole in root space. */
  readonly defaultPole: V3
  readonly kind: 'foot' | 'hand'
}

export const LIMBS: Readonly<Record<LimbId, Limb>> = {
  footL: {
    chain: [J['thigh.L'], J['shin.L'], J['foot.L']],
    pole: 'kneeL',
    bend: 1,
    defaultPole: [0, 0, 1],
    kind: 'foot',
  },
  footR: {
    chain: [J['thigh.R'], J['shin.R'], J['foot.R']],
    pole: 'kneeR',
    bend: 1,
    defaultPole: [0, 0, 1],
    kind: 'foot',
  },
  handL: {
    chain: [J['upperArm.L'], J['foreArm.L'], J['hand.L']],
    pole: 'elbowL',
    bend: -1,
    defaultPole: [0.7, -0.5, -0.5],
    kind: 'hand',
  },
  handR: {
    chain: [J['upperArm.R'], J['foreArm.R'], J['hand.R']],
    pole: 'elbowR',
    bend: -1,
    defaultPole: [-0.7, -0.5, -0.5],
    kind: 'hand',
  },
}

export const LIMB_IDS: readonly LimbId[] = ['footL', 'footR', 'handL', 'handR']

/** The default pole of `limb` in world space, turned with the root. */
export const defaultPole = (limb: LimbId, root: M): V3 => applyDir(root, LIMBS[limb].defaultPole)

/** Solves `limb` so its end lands on `target` (world), bending toward `pole` (a world direction); `end` sets
 * the end's world rotation. `world` must be current for the limb root's parent. */
export function solveLimb(
  s: Skeleton,
  pose: Pose,
  world: readonly M[],
  limb: LimbId,
  target: V3,
  pole: V3,
  end?: R3,
): void {
  const { chain, bend } = LIMBS[limb]
  twoBoneIK(s, pose, world, chain[0], chain[1], chain[2], target, pole, bend, end)
}
