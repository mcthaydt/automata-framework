import { describe, expect, it } from 'vitest'
import { at, clonePose, fk, J, type Pose, restPose } from '#src/features/figures/body/rig.ts'
import { angleBetween, eulerDegrees } from '#src/features/figures/motion/rotation.ts'
import { solve } from '#src/features/figures/motion/solve.ts'
import type { Targets, Vec3 } from '#src/features/figures/motion/targets.ts'
import {
  add,
  apply,
  invertRigid,
  matq,
  mul3,
  type Q,
  qmat,
  rotationOf,
  scale,
} from '#src/shared/math/math.ts'
import { at3, distance, KEEPER, NO_TARGETS, OPEN_LIMITS, unit, WICK } from '#src/testing/solve-fixtures.ts'

const targets = (extra: Partial<Targets>): Targets => ({ ...NO_TARGETS, ...extra })
const worldTurn = (world: ReturnType<typeof fk>, joint: number): Q => matq(rotationOf(at(world, joint)))
const scaled = (v: Vec3, k: number): Vec3 => [v[0] * k, v[1] * k, v[2] * k]

function turnedBase(): Pose {
  const base = restPose()
  base.root = [1, 0, 2]
  base.yaw = -0.4
  return base
}

describe('hips and torso', () => {
  it('moves and turns the pelvis, and re-solves the legs so the feet keep their place and turn', () => {
    const k = unit(WICK)
    const base = turnedBase()
    const before = fk(WICK, base)
    const pelvis = scale(at(WICK.rest, J.pelvis), 1 / k)
    const pos: Vec3 = [pelvis[0] + 0.03, pelvis[1] - 0.08, pelvis[2] + 0.02]
    const { pose, world, report } = solve(
      WICK,
      base,
      targets({ effectors: { pelvis: { pos, rot: [6, 15, -4] } } }),
      OPEN_LIMITS,
    )
    const wanted = apply(at(before, J.root), [...scaled(pos, k)])
    expect(distance(at3(world, J.pelvis), wanted)).toBeLessThan(1e-12)
    expect(angleBetween(at(pose.rot, J.pelvis), eulerDegrees([6, 15, -4]))).toBeLessThan(1e-12)
    for (const foot of [J['foot.L'], J['foot.R']]) {
      expect(distance(at3(world, foot), at3(before, foot)) / k).toBeLessThan(1e-6)
      expect(angleBetween(worldTurn(world, foot), worldTurn(before, foot))).toBeLessThan(1e-9)
    }
    expect(report.reached.pelvis).toEqual({ ok: true, error: expect.any(Number) })
    expect(report.reached.footL?.ok).toBe(true)
  })
  it("shares the chest's turn 0.3/0.7 between spine and chest, and the head's 0.4/0.6 between neck and head", () => {
    const { pose, report } = solve(
      WICK,
      restPose(),
      targets({ effectors: { chest: { rot: [10, 20, 4] }, head: { rot: [-10, 30, 5] } } }),
      OPEN_LIMITS,
    )
    const expectTurn = (joint: number, rot: Vec3): void =>
      expect(angleBetween(at(pose.rot, joint), eulerDegrees(rot))).toBeLessThan(1e-12)
    expectTurn(J.spine, [3, 6, 1.2])
    expectTurn(J.chest, [7, 14, 2.8])
    expectTurn(J.neck, [-4, 12, 2])
    expectTurn(J.head, [-6, 18, 3])
    expect(report.reached.chest?.ok).toBe(true)
    expect(report.reached.head?.ok).toBe(true)
  })
  it('turns a hand to a world rotation given in root space', () => {
    const base = turnedBase()
    const { world } = solve(
      WICK,
      base,
      targets({ effectors: { handL: { rot: [30, 10, -20] } } }),
      OPEN_LIMITS,
    )
    const rootTurn = rotationOf(at(fk(WICK, base), J.root))
    const expected = matq(mul3(rootTurn, qmat(eulerDegrees([30, 10, -20]))))
    expect(angleBetween(worldTurn(world, J['hand.L']), expected)).toBeLessThan(1e-9)
  })
})

describe('weights, figure units and purity', () => {
  it('blends a limb target and a rotation by weight from the base pose', () => {
    const k = unit(WICK)
    const base = restPose()
    const before = fk(WICK, base)
    const shoulder = scale(at(WICK.rest, J['upperArm.L']), 1 / k)
    const pos: Vec3 = [shoulder[0], shoulder[1] - 0.25, shoulder[2] + 0.2]
    const half = solve(WICK, base, targets({ effectors: { handL: { pos, weight: 0.5 } } }), OPEN_LIMITS)
    const midway = scale(add(scale([...pos], k), at3(before, J['hand.L'])), 0.5)
    expect(distance(at3(half.world, J['hand.L']), midway)).toBeLessThan(1e-9)
    const none = solve(
      WICK,
      base,
      targets({ effectors: { chest: { rot: [20, 0, 0], weight: 0 } } }),
      OPEN_LIMITS,
    )
    expect(angleBetween(at(none.pose.rot, J.chest), at(base.rot, J.chest))).toBeLessThan(1e-12)
  })
  it('scales a figure-unit target by height / 1.62, so one pose fits every figure', () => {
    // Below and ahead of the right shoulder in figure units: inside both figures' reach.
    const shoulder = scale(at(WICK.rest, J['upperArm.R']), 1 / unit(WICK))
    const pos: Vec3 = [shoulder[0], shoulder[1] - 0.25, shoulder[2] + 0.2]
    for (const s of [WICK, KEEPER]) {
      const { world } = solve(s, restPose(), targets({ effectors: { handR: { pos } } }), OPEN_LIMITS)
      const inRoot = apply(invertRigid(at(world, J.root)), at3(world, J['hand.R']))
      expect(distance(inRoot, [...scaled(pos, unit(s))])).toBeLessThan(1e-9)
    }
  })
  it('never writes its base and gives the same answer for the same input', () => {
    const base = turnedBase()
    base.rot[J.chest] = eulerDegrees([12, 0, 0])
    const copy = clonePose(base)
    const t = targets({
      effectors: { footL: { pos: [0.1, 0.1, 0.2] }, pelvis: { rot: [0, 10, 0] }, chest: { rot: [5, 5, 0] } },
      poles: { elbowR: { dir: [0, 0, -1], space: 'chest' } },
      aim: [{ at: [1, 1, 4], part: 'head' }],
      pins: { handR: [0.9, 0.7, 2.2] },
    })
    const first = solve(WICK, base, t, OPEN_LIMITS)
    expect(base).toEqual(copy)
    expect(solve(WICK, base, t, OPEN_LIMITS)).toEqual(first)
  })
})
