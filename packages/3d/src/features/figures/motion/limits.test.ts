import { beforeAll, describe, expect, it } from 'vitest'
import { add, axisAngle, euler, hash, type Q, qmul, scale } from '../../../shared/math/math.ts'
import { fixtureLimits } from '../../../testing/fixture-limits.ts'
import { direction, KEEPER, NO_TARGETS, OPEN_LIMITS, unit, WICK } from '../../../testing/solve-fixtures.ts'
import { at, J, JOINTS, type Joint, type Pose, restPose } from '../body/rig.ts'
import type { RigLimits } from '../content/rig-limits.schema.ts'
import { LIMBS } from './limbs.ts'
import { clampJoint, hingeFlexion, jointLimits, limitExcess, swingAngle } from './limits.ts'
import { angleBetween, degrees, eulerOf, radians } from './rotation.ts'
import { solve } from './solve.ts'
import type { LimbId, Vec3 } from './targets.ts'

let limits: RigLimits
beforeAll(async () => {
  limits = await fixtureLimits()
})

const X: [number, number, number] = [1, 0, 0]

describe('reading a joint against its limit', () => {
  it('reads a knee bent back and an elbow bent forward as positive flexion, in degrees', () => {
    expect(hingeFlexion(axisAngle(X, radians(40)), 'knee')).toBeCloseTo(40, 10)
    expect(hingeFlexion(axisAngle(X, radians(-40)), 'elbow')).toBeCloseTo(40, 10)
    expect(hingeFlexion(axisAngle(X, radians(-10)), 'knee')).toBeCloseTo(-10, 10)
  })
  it("reads a shoulder or hip's swing from hanging straight down, whatever its twist", () => {
    const swung = qmul(axisAngle([0, 0, 1], radians(60)), axisAngle([0, 1, 0], radians(33)))
    expect(swingAngle(swung)).toBeCloseTo(60, 10)
    expect(swingAngle(axisAngle([0, 1, 0], radians(80)))).toBeCloseTo(0, 10)
  })
})

describe('clamping one joint', () => {
  it('leaves a joint inside its limits untouched (null)', () => {
    const table = jointLimits(limits)
    expect(clampJoint(axisAngle(X, radians(60)), table.get(J['shin.L']))).toBeNull()
    expect(clampJoint(euler(radians(10), radians(20), 0), table.get(J.neck))).toBeNull()
    expect(clampJoint(euler(0.4, 0.3, 0.2), undefined)).toBeNull()
  })
  it('folds a hinge back to its bound', () => {
    const table = jointLimits(limits)
    const knee = clampJoint(axisAngle(X, radians(170)), table.get(J['shin.R'])) as Q
    expect(hingeFlexion(knee, 'knee')).toBeCloseTo(limits.knee.max, 10)
    const elbow = clampJoint(axisAngle(X, radians(20)), table.get(J['foreArm.L'])) as Q
    expect(hingeFlexion(elbow, 'elbow')).toBeCloseTo(limits.elbow.min, 10)
  })
  it('brings a cone back to its edge and keeps the twist about the bone', () => {
    const table = jointLimits(limits)
    const twist = axisAngle([0, 1, 0], radians(25))
    const past = qmul(axisAngle([1, 0, 0], radians(limits.hip.cone + 10)), twist)
    const hip = clampJoint(past, table.get(J['thigh.L'])) as Q
    expect(swingAngle(hip)).toBeCloseTo(limits.hip.cone, 10)
    const expected = qmul(axisAngle([1, 0, 0], radians(limits.hip.cone)), twist)
    for (const [i, v] of hip.entries()) expect(v).toBeCloseTo(expected[i] as number, 10)
  })
  it('clamps the neck and head by their euler ranges, and the spine and chest by their shares of the chest', () => {
    const table = jointLimits(limits)
    const neck = clampJoint(euler(0, radians(80), 0), table.get(J.neck)) as Q
    expect(degrees(eulerOf(neck)[1])).toBeCloseTo(limits.neck.yaw.max, 10)
    const head = clampJoint(euler(radians(-60), 0, radians(40)), table.get(J.head)) as Q
    const [pitch, , roll] = eulerOf(head)
    expect(degrees(pitch)).toBeCloseTo(limits.head.pitch.min, 10)
    expect(degrees(roll)).toBeCloseTo(limits.head.roll.max, 10)
    const spine = clampJoint(euler(0, radians(-30), 0), table.get(J.spine)) as Q
    expect(degrees(eulerOf(spine)[1])).toBeCloseTo(0.3 * limits.chest.twist.min, 10)
    const chest = clampJoint(euler(radians(40), 0, 0), table.get(J.chest)) as Q
    expect(degrees(eulerOf(chest)[0])).toBeCloseTo(0.7 * limits.chest.pitch.max, 10)
  })
})

const LIMITED = [...jointLimits(OPEN_LIMITS).keys()]
/** The joints whose local rotation in `pose` is past `table`'s limit by more than rounding. */
const pastLimits = (pose: Pose, table: ReturnType<typeof jointLimits>): Joint[] =>
  LIMITED.filter((joint) => limitExcess(at(pose.rot, joint), table.get(joint)) > 1e-9)
    .sort((a, b) => a - b)
    .map((joint) => at(JOINTS, joint))

describe('clamping across the ±180° seams', () => {
  it('clamps a head pitched past 90° to its pitch bound, not to a flipped yaw and roll', () => {
    const table = jointLimits(limits)
    // 96° of pitch reads back from the euler as (84°, 180°, 180°); the same turn as (96°, 0°, 0°) needs far less
    // correction, so the clamp reads it that way.
    const head = clampJoint(euler(radians(96), 0, 0), table.get(J.head)) as Q
    expect(degrees(angleBetween(head, euler(radians(limits.head.pitch.max), 0, 0)))).toBeLessThan(1e-9)
    const { pose } = solve(
      WICK,
      restPose(),
      { ...NO_TARGETS, effectors: { head: { rot: [160, 0, 0] } } },
      limits,
    )
    expect(
      degrees(angleBetween(at(pose.rot, J.head), euler(radians(limits.head.pitch.max), 0, 0))),
    ).toBeLessThan(1e-9)
  })
  it('clamps a hinge to the bound nearer round the circle', () => {
    const table = jointLimits(limits)
    // A knee bent −170° is 190° the other way: 40° past 150, but 170° short of 0.
    const knee = clampJoint(axisAngle(X, radians(-170)), table.get(J['shin.L'])) as Q
    expect(hingeFlexion(knee, 'knee')).toBeCloseTo(limits.knee.max, 10)
    expect(limitExcess(axisAngle(X, radians(-170)), table.get(J['shin.L']))).toBeCloseTo(40, 10)
  })
})

describe('I-c: after a solve no joint passes its limit, and the report lists exactly the clamped ones', () => {
  it('measures how far past its limit a joint is, in degrees', () => {
    const table = jointLimits(limits)
    expect(limitExcess(axisAngle(X, radians(160)), table.get(J['shin.L']))).toBeCloseTo(
      160 - limits.knee.max,
      10,
    )
    expect(limitExcess(axisAngle(X, radians(30)), table.get(J['shin.L']))).toBe(0)
    expect(limitExcess(euler(0, radians(-100), 0), table.get(J.head))).toBeCloseTo(
      100 + limits.head.yaw.min,
      10,
    )
  })
  it('clamps limbs folded, raised and thrown back, and lists only those joints', () => {
    const table = jointLimits(limits)
    let clampedSome = 0
    for (const [seed, s] of [WICK, KEEPER].flatMap((s, i) =>
      Array.from({ length: 40 }, (_, n) => [i * 1000 + n, s] as const),
    )) {
      const k = unit(s)
      const limb = (['footL', 'footR', 'handL', 'handR'] as const)[seed % 4] as LimbId
      const [a] = LIMBS[limb].chain
      const root = scale(at(s.rest, a), 1 / k)
      const pos = add(root, scale(direction(seed), 0.05 + 0.5 * hash(seed + 7)))
      const t = { ...NO_TARGETS, effectors: { [limb]: { pos } } }
      const open = solve(s, restPose(), t, OPEN_LIMITS)
      const limited = solve(s, restPose(), t, limits)
      const expected = pastLimits(open.pose, table)
      expect(limited.report.limited).toEqual(expected)
      expect(pastLimits(limited.pose, table)).toEqual([])
      if (expected.length > 0) {
        clampedSome++
        expect(limited.report.reached[limb]?.ok).toBe(false)
      }
    }
    // The spread must actually reach the limits for the check to mean anything.
    expect(clampedSome).toBeGreaterThan(10)
  })
  it('clamps the chest and head turns joint by joint, by their shares', () => {
    const table = jointLimits(limits)
    for (let seed = 0; seed < 40; seed++) {
      const turn = (n: number): Vec3 => [
        200 * hash(seed * 8 + n) - 100,
        300 * hash(seed * 8 + n + 1) - 150,
        120 * hash(seed * 8 + n + 2) - 60,
      ]
      const t = { ...NO_TARGETS, effectors: { chest: { rot: turn(0) }, head: { rot: turn(3) } } }
      const open = solve(WICK, restPose(), t, OPEN_LIMITS)
      const limited = solve(WICK, restPose(), t, limits)
      const expected = pastLimits(open.pose, table)
      expect(limited.report.limited).toEqual(expected)
      expect(pastLimits(limited.pose, table)).toEqual([])
      const chestClamped = expected.includes('spine') || expected.includes('chest')
      expect(limited.report.reached.chest?.ok).toBe(!chestClamped)
    }
  })
  it("does not clamp the source's reach and flinch under the default limits (both figures, both sides)", () => {
    for (const s of [WICK, KEEPER]) {
      const k = unit(s),
        g = s.genes
      for (const [side, x] of [
        ['L', 1],
        ['R', -1],
      ] as const) {
        const hand = `hand${side}` as const,
          elbow = `elbow${side}` as const
        // FigureBuilder motion.ts at a1f7246: the reach's default target and pole, and the flinch's.
        const reach: Vec3 = [(x * g.shoulders * 0.8) / k, (s.shoulderY - 0.18 * k) / k, 0.5]
        const flinch: Vec3 = [x * 0.06, (s.chinY + 0.1 * k) / k, 0.21]
        for (const [pos, dir] of [
          [reach, [x * 0.7, -0.5, -0.5]],
          [flinch, [x * 0.5, -1, 0.1]],
        ] as const) {
          const { report } = solve(
            s,
            restPose(),
            { ...NO_TARGETS, effectors: { [hand]: { pos } }, poles: { [elbow]: { dir } } },
            limits,
          )
          expect(report.limited).toEqual([])
        }
      }
    }
  })
})

describe('the tuned default limits (fixture figure-rigs/default.toml)', () => {
  it('let an arm point 60° above level (a hookshot aimed up) and a thigh rise 110° (a deep seat, a climb)', () => {
    const table = jointLimits(limits)
    expect(clampJoint(axisAngle(X, radians(-150)), table.get(J['upperArm.R']))).toBeNull()
    expect(clampJoint(axisAngle(X, radians(-110)), table.get(J['thigh.L']))).toBeNull()
  })
  it('turn the head at most 115° from the hips: the chest 35°, the neck 35°, the head 45°', () => {
    const { chest, neck, head } = limits
    expect(chest.twist.max + neck.yaw.max + head.yaw.max).toBe(115)
    expect([chest.twist.min, neck.yaw.min, head.yaw.min]).toEqual([-35, -35, -45])
  })
})
