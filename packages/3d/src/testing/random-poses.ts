// Seeded random poses for the pose tests' properties (round trips, mirror twice). `hash` noise, no
// Math.random: the same seed gives the same pose. Each handle, pole and joint is present or not by a coin, and
// numbers carry more decimals than the canonical spelling keeps, so rounding is exercised.

import { JOINTS, type Joint } from '../features/figures/body/rig.ts'
import type { PoseDef } from '../features/figures/motion/pose.schema.ts'
import type {
  EffectorId,
  EffectorTarget,
  PoleId,
  PoleTarget,
  Vec3,
} from '../features/figures/motion/targets.ts'
import { hash } from '../shared/math/math.ts'

/** A seeded source of numbers. */
function source(seed: number): { next: (lo: number, hi: number) => number; coin: () => boolean } {
  let n = seed * 7919
  const next = (lo: number, hi: number): number => lo + (hi - lo) * hash(++n)
  return { next, coin: () => hash(++n) < 0.5 }
}

export function randomPose(seed: number): PoseDef {
  const { next, coin } = source(seed)
  const vec = (size: number): Vec3 => [next(-size, size), next(-size, size), next(-size, size)]
  const effectors: Partial<Record<EffectorId, EffectorTarget>> = {}
  for (const id of ['footL', 'footR', 'handL', 'handR'] as const) {
    if (!coin()) continue
    effectors[id] = {
      ...(coin() ? { pos: vec(1) } : {}),
      ...(coin() ? { rot: vec(170) } : {}),
      ...(coin() ? { space: coin() ? 'chest' : 'root' } : {}),
      ...(coin() ? { weight: next(0, 1) } : {}),
    }
  }
  if (coin()) effectors.pelvis = { pos: vec(1), ...(coin() ? { rot: vec(40) } : {}) }
  if (coin()) effectors.chest = { rot: vec(30), ...(coin() ? { weight: next(0, 1) } : {}) }
  if (coin()) effectors.head = { rot: vec(30) }
  const poles: Partial<Record<PoleId, PoleTarget>> = {}
  for (const id of ['kneeL', 'kneeR', 'elbowL', 'elbowR'] as const)
    if (coin()) poles[id] = { dir: vec(1), ...(coin() ? { space: 'chest' as const } : {}) }
  const fk: Partial<Record<Joint, Vec3>> = {}
  for (const joint of JOINTS)
    if (hash(seed * 31 + joint.length * 17 + joint.charCodeAt(0)) < 0.2) fk[joint] = vec(60)
  return {
    ...(coin() ? { about: `random pose ${seed}` } : {}),
    effectors,
    ...(coin() ? { poles } : {}),
    ...(coin() ? { fk } : {}),
    ...(coin()
      ? { root: { ...(coin() ? { pos: vec(0.5) } : {}), ...(coin() ? { yaw: next(-180, 180) } : {}) } }
      : {}),
  }
}
