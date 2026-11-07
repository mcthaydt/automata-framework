import { describe, expect, it } from 'vitest'
import { add, apply, axisAngle, compose, qmul, scale } from '../../../shared/math/math.ts'
import { unit, WICK } from '../../../testing/solve-fixtures.ts'
import { J, restPose } from '../body/rig.ts'
import { applyPose } from './apply-pose.ts'
import type { PoseDef } from './pose.schema.ts'
import { eulerDegrees, radians } from './rotation.ts'

const pose: PoseDef = {
  effectors: { handR: { pos: [-0.16, 1.3, 0.52] }, chest: { rot: [5, 0, 0] } },
  poles: { elbowR: { dir: [-0.6, -1, 0] } },
  fk: { 'clavicle.L': [0, 0, 6] },
  root: { pos: [0.1, 0, 0.2], yaw: 15 },
}

describe('applyPose', () => {
  it("turns fk joints on top of the base's local rotations", () => {
    const base = restPose()
    base.rot[J['clavicle.L']] = axisAngle([0, 1, 0], 0.3)
    const { base: posed } = applyPose(WICK, base, pose)
    expect(posed.rot[J['clavicle.L']]).toEqual(qmul(axisAngle([0, 1, 0], 0.3), eulerDegrees([0, 0, 6])))
    expect(posed.rot[J['clavicle.R']]).toEqual(base.rot[J['clavicle.R']])
  })
  it('moves the root in its own frame, in figure units, then turns it', () => {
    const base = restPose()
    base.root = [1, 0, 2]
    base.yaw = 0.4
    const { base: posed } = applyPose(WICK, base, pose)
    const frame = compose(axisAngle([0, 1, 0], 0.4), [1, 0, 2])
    const want = apply(frame, scale([0.1, 0, 0.2], unit(WICK)))
    for (let i = 0; i < 3; i++) expect(posed.root[i]).toBeCloseTo(want[i] ?? Number.NaN, 15)
    expect(posed.yaw).toBeCloseTo(0.4 + radians(15), 15)
    expect(add(posed.root, [0, 0, 0])).not.toEqual(base.root)
  })
  it('hands the effectors and poles to the solve, with no aim and no pins', () => {
    const { targets } = applyPose(WICK, restPose(), pose)
    expect(targets).toEqual({ effectors: pose.effectors, poles: pose.poles, aim: [], pins: {} })
    expect(applyPose(WICK, restPose(), { effectors: {} }).targets.poles).toEqual({})
  })
  it('does not change the base', () => {
    const base = restPose()
    const copy = structuredClone(base)
    applyPose(WICK, base, pose)
    expect(base).toEqual(copy)
  })
})
