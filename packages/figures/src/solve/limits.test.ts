import { beforeAll, describe, expect, it } from 'vitest'
import type { RigLimits } from '../library/rig-limits.schema'
import { axisAngle, euler, type Q, qmul } from '../math/math'
import { J } from '../rig/rig'
import { fixtureLimits } from '../testing/fixture-limits'
import { clampJoint, hingeFlexion, jointLimits, swingAngle } from './limits'
import { degrees, eulerOf, radians } from './rotation'

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
