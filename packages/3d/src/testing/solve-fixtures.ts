// Shared inputs for the solver's tests: the fixture skeletons, limits that never clamp (to test reach apart
// from limits), empty targets, and small vector helpers.

import { measure } from '../features/figures/body/genes.ts'
import { at, type Skeleton, skeletonFromGenes } from '../features/figures/body/rig.ts'
import type { RigLimits } from '../features/figures/content/rig-limits.schema.ts'
import type { Targets } from '../features/figures/motion/targets.ts'
import { apply, hash, type M, sub, type V3 } from '../shared/math/math.ts'
import { KEEPER_SLIDERS, WICK_SLIDERS } from './fixture-sliders.ts'

export const WICK: Skeleton = skeletonFromGenes(measure(WICK_SLIDERS).genes)
export const KEEPER: Skeleton = skeletonFromGenes(measure(KEEPER_SLIDERS).genes)

const any = { min: -180, max: 180 }
/** Limits wide enough that nothing clamps. */
export const OPEN_LIMITS: RigLimits = {
  elbow: any,
  knee: any,
  shoulder: { cone: 180 },
  hip: { cone: 180 },
  chest: { twist: any, pitch: any },
  neck: { yaw: any, pitch: any },
  head: { yaw: any, pitch: any, roll: any },
}

export const NO_TARGETS: Targets = { effectors: {}, poles: {}, aim: [], pins: {} }

/** The figure's scale: 1 figure unit is k metres. */
export const unit = (s: Skeleton): number => s.genes.height / 1.62

/** A joint's world position. */
export const at3 = (world: readonly M[], joint: number): V3 => apply(at(world, joint), [0, 0, 0])

/** A deterministic unit vector for seed `n` (hash noise, no Math.random). */
export function direction(n: number): V3 {
  const z = 2 * hash(n * 2 + 1) - 1,
    a = 2 * Math.PI * hash(n * 2 + 2),
    r = Math.sqrt(1 - z * z)
  return [r * Math.cos(a), r * Math.sin(a), z]
}

/** The distance from a to b. */
export const distance = (a: V3, b: V3): number => Math.hypot(...sub(a, b))
