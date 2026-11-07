import { Container3D } from '@pixi/3d'
import { describe, expect, it } from 'vitest'
import { apply, axisAngle, compose } from '../../../shared/math/math.ts'
import { placeJoint } from './figure-joints.ts'

describe('placeJoint', () => {
  it("sets a joint container's position and turn from the joint's world matrix", () => {
    const turn = axisAngle([0, 1, 0], Math.PI / 2)
    const m = compose(turn, [0.5, 1.2, -0.3])
    // The figures maths turn +z to +x by a quarter turn about y; the container takes the same turn.
    expect(apply(m, [0, 0, 1]).map((v) => Math.round(v * 1e6) / 1e6)).toEqual([1.5, 1.2, -0.3])
    const node = new Container3D()
    placeJoint(node, m)
    expect([node.position.x, node.position.y, node.position.z]).toEqual([0.5, 1.2, -0.3])
    const q = node.quaternion
    expect(q.x).toBeCloseTo(turn[0])
    expect(q.y).toBeCloseTo(turn[1])
    expect(q.z).toBeCloseTo(turn[2])
    expect(q.w).toBeCloseTo(turn[3])
  })
})
