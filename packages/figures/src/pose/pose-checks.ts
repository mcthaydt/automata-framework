// The checks a pose must pass beyond its shape (M3 spec §4.4.3, §6): every position within twice the figure's
// reach of the root. Positions are in figure units (1 unit is 1 m on a 1.62 m figure, times height / 1.62 at
// solve time), so a pose fits every figure up to its proportions.
//
// Which figure? No content says which figures use a pose (figures name none; clips and the sim do), so the
// content compile checks against the reference figure, the default sliders' skeleton. A figure's reach in
// figure units differs from the reference's only by its proportions (Wick's and the keeper's by under 10%),
// and the bound is twice the reach, so the compile check catches typos, not fits. The Studio or a game checks
// a pose against one figure by passing its skeleton.

import { measure } from '../genes/genes'
import { add, length, scale, type V3 } from '../math/math'
import { at, J, type Skeleton, skeletonFromGenes } from '../rig/rig'
import { LIMB_IDS, LIMBS } from '../solve/limbs'
import type { Vec3 } from '../solve/targets'
import type { PoseDef } from './pose.schema'

/** The figure a pose is checked against at content compile: the default sliders' skeleton. */
export const REFERENCE_SKELETON: Skeleton = skeletonFromGenes(measure({}).genes)

const unitOf = (s: Skeleton): number => s.genes.height / 1.62

/** The bone lengths of a limb: its root to its middle joint, its middle to its end. */
const limbLength = (s: Skeleton, limb: (typeof LIMB_IDS)[number]): number => {
  const [, middle, end] = LIMBS[limb].chain
  return length(at(s.offset, middle)) + length(at(s.offset, end))
}

/**
 * The farthest a limb end gets from the root at rest, in figure units: for each limb, the distance from the
 * root to its root joint (a shoulder, a hip) plus its two bones; the largest of the four.
 */
export function figureReach(s: Skeleton): number {
  let reach = 0
  for (const limb of LIMB_IDS) {
    const root = LIMBS[limb].chain[0]
    reach = Math.max(reach, length(at(s.rest, root)) + limbLength(s, limb))
  }
  return reach / unitOf(s)
}

/** A problem with a pose: the path of the field and what is wrong with its value. */
export interface PoseProblem {
  readonly path: readonly (string | number)[]
  readonly message: string
}

const spell = (v: Vec3): string => `[${v.join(', ')}]`

/**
 * The pose's positions past twice `skeleton`'s reach from the root (the reference figure's by default). A
 * position in chest space is measured from the root through the skeleton's rest chest.
 */
export function poseProblems(pose: PoseDef, skeleton: Skeleton = REFERENCE_SKELETON): PoseProblem[] {
  const bound = 2 * figureReach(skeleton)
  const chest = scale(at(skeleton.rest, J.chest), 1 / unitOf(skeleton))
  const problems: PoseProblem[] = []
  const check = (path: readonly (string | number)[], pos: Vec3, from: V3): void => {
    const distance = length(add(from, [...pos]))
    if (distance > bound)
      problems.push({
        path,
        message: `${spell(pos)} is ${round(distance)} figure units from the root, past twice the figure's reach (${round(bound)})`,
      })
  }
  for (const id of LIMB_AND_BODY) {
    const target = pose.effectors[id]
    if (target?.pos) check(['effectors', id, 'pos'], target.pos, target.space === 'chest' ? chest : [0, 0, 0])
  }
  if (pose.root?.pos) check(['root', 'pos'], pose.root.pos, [0, 0, 0])
  return problems
}

/** The effectors that take a position, in `EffectorId` order. */
const LIMB_AND_BODY = ['footL', 'footR', 'handL', 'handR', 'pelvis'] as const

const round = (n: number): number => Math.round(n * 1000) / 1000
