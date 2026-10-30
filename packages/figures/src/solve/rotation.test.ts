import { describe, expect, it } from 'vitest'
import { axisAngle, euler, IDENTITY_Q, type Q } from '../math/math'
import { angleBetween, degrees, eulerOf, radians, slerp } from './rotation'

const close = (a: Q, b: Q, digits = 12): void => {
  // q and −q are one rotation.
  const sign = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3] < 0 ? -1 : 1
  for (const [i, v] of a.entries()) expect(v * sign).toBeCloseTo(b[i] as number, digits)
}

describe('rotation helpers for the solver', () => {
  it('converts degrees and radians', () => {
    expect(radians(180)).toBe(Math.PI)
    expect(degrees(Math.PI / 2)).toBe(90)
  })
  it("reads back the source's euler (yaw · pitch · roll) as (pitch, yaw, roll)", () => {
    for (const [p, y, r] of [
      [0.3, -0.7, 0.2],
      [-1.2, 2.5, -0.4],
      [0, 0, 0],
      [0.01, 3, -3],
    ] as const) {
      const [p2, y2, r2] = eulerOf(euler(p, y, r))
      expect(p2).toBeCloseTo(p, 12)
      expect(y2).toBeCloseTo(y, 12)
      expect(r2).toBeCloseTo(r, 12)
    }
  })
  it('slerps between two rotations along the shorter arc', () => {
    const a = axisAngle([0, 1, 0], 0.2),
      b = axisAngle([0, 1, 0], 1.0)
    close(slerp(a, b, 0), a)
    close(slerp(a, b, 1), b)
    close(slerp(a, b, 0.5), axisAngle([0, 1, 0], 0.6))
    const negated: Q = [-b[0], -b[1], -b[2], -b[3]]
    close(slerp(a, negated, 0.5), axisAngle([0, 1, 0], 0.6))
    close(slerp(IDENTITY_Q, IDENTITY_Q, 0.3), IDENTITY_Q)
  })
  it('measures the angle between two rotations', () => {
    expect(angleBetween(axisAngle([1, 0, 0], 0.4), axisAngle([1, 0, 0], -0.1))).toBeCloseTo(0.5, 12)
    expect(angleBetween(IDENTITY_Q, IDENTITY_Q)).toBe(0)
  })
})
