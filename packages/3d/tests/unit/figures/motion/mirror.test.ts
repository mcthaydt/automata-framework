import { describe, expect, it } from 'vitest'
import { mirror } from '#src/features/figures/motion/mirror.ts'
import type { PoseDef } from '#src/features/figures/motion/pose.schema.ts'
import { canonicalPose } from '#src/features/figures/motion/pose-spelling.ts'
import { eulerDegrees } from '#src/features/figures/motion/rotation.ts'
import type { Vec3 } from '#src/features/figures/motion/targets.ts'
import { qmat, type R3 } from '#src/shared/math/math.ts'
import { randomPose } from '#src/testing/random-poses.ts'

/** Every number in a value, depth first. */
function numbers(value: unknown): number[] {
  if (typeof value === 'number') return [value]
  if (typeof value === 'object' && value !== null) return Object.values(value).flatMap(numbers)
  return []
}

const S = [-1, 1, 1] as const
/** S·R·S, S = diag(−1, 1, 1): a rotation seen in the mirror. */
const reflected = (r: R3): R3 => r.map((v, i) => v * (S[Math.floor(i / 3)] ?? 1) * (S[i % 3] ?? 1)) as R3

describe('mirror', () => {
  const pose: PoseDef = {
    about: 'Reaching with the right.',
    effectors: {
      handR: { pos: [-0.16, 1.3, 0.52], rot: [-90, 20, 10], weight: 0.5 },
      footL: { pos: [0.1, 0.08, 0.3], space: 'chest' },
      pelvis: { pos: [0.02, 0.8, 0], rot: [3, 10, -5] },
      head: { rot: [5, -10, 2] },
    },
    poles: { elbowR: { dir: [-0.6, -1, 0.2] }, kneeL: { dir: [0.1, 0, 1], space: 'chest' } },
    fk: { 'clavicle.R': [0, 4, -6], hemL: [10, 0, 0], root: [0, 3, 1] },
    root: { pos: [0.1, 0, 0.2], yaw: 15 },
  }
  it('swaps left and right and negates x, yaw and roll', () => {
    expect(mirror(pose)).toEqual({
      about: 'Reaching with the right.',
      effectors: {
        handL: { pos: [0.16, 1.3, 0.52], rot: [-90, -20, -10], weight: 0.5 },
        footR: { pos: [-0.1, 0.08, 0.3], space: 'chest' },
        pelvis: { pos: [-0.02, 0.8, 0], rot: [3, -10, 5] },
        head: { rot: [5, 10, -2] },
      },
      poles: { elbowL: { dir: [0.6, -1, 0.2] }, kneeR: { dir: [-0.1, 0, 1], space: 'chest' } },
      fk: { 'clavicle.L': [0, -4, 6], hemR: [10, 0, 0], root: [0, -3, -1] },
      root: { pos: [-0.1, 0, 0.2], yaw: -15 },
    })
  })
  it('turns each Euler rotation into its reflection S·R·S', () => {
    for (const rot of [
      [-90, 20, 10],
      [30, -70, 45],
      [5, 170, -100],
    ] as Vec3[]) {
      const turned = mirror({ effectors: { head: { rot } } }).effectors.head?.rot ?? [0, 0, 0]
      const want = reflected(qmat(eulerDegrees(rot)))
      const got = qmat(eulerDegrees(turned))
      for (let i = 0; i < 9; i++) expect(got[i]).toBeCloseTo(want[i] ?? Number.NaN, 12)
    }
  })
  it('never writes -0', () => {
    const zeros: PoseDef = { effectors: { handL: { pos: [0, 0, 0], rot: [0, 0, 0] } }, root: { yaw: 0 } }
    for (const n of numbers(mirror(zeros))) expect(Object.is(n, -0)).toBe(false)
  })
  it('gives back the pose when applied twice (200 seeded poses)', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const p = canonicalPose(randomPose(seed))
      expect(mirror(mirror(p))).toEqual(p)
    }
  })
  it('does not change its argument', () => {
    const copy = structuredClone(pose)
    mirror(pose)
    expect(pose).toEqual(copy)
  })
})
