import { describe, expect, it } from 'vitest'
import {
  apply,
  axisAngle,
  compose,
  euler,
  hash,
  IDENTITY,
  invertRigid,
  type M,
  matq,
  mmul,
  normalize,
  type Q,
  qconj,
  qmat,
  qmul,
  type V3,
} from './math'

const close = (actual: readonly number[], expected: readonly number[], digits = 12): void => {
  expect(actual).toHaveLength(expected.length)
  for (const [index, value] of actual.entries())
    expect(value).toBeCloseTo(expected[index] ?? Number.NaN, digits)
}
/** q and −q are the same rotation. */
const sameRotation = (a: Q, b: Q): void =>
  a[3] * b[3] < 0
    ? close(
        a,
        b.map((v) => -v),
      )
    : close(a, b)

describe('figure math (FigureBuilder math.ts at a1f7246)', () => {
  it('turns +x a quarter about +y onto −z (y up, the figure facing +z)', () => {
    close(apply(compose(axisAngle([0, 1, 0], Math.PI / 2), [0, 0, 0]), [1, 0, 0]), [0, 0, -1])
  })
  it('round-trips a rotation through its matrix', () => {
    for (const q of [
      axisAngle([1, 2, 3], 0.7),
      axisAngle([0, 0, 1], 3),
      axisAngle([1, 0, 0], -2.5),
      euler(0.3, -1.2, 0.4),
    ]) {
      sameRotation(matq(qmat(q)), q)
    }
  })
  it('applies euler as yaw · pitch · roll', () => {
    sameRotation(
      euler(0.2, 0.5, -0.3),
      qmul(qmul(axisAngle([0, 1, 0], 0.5), axisAngle([1, 0, 0], 0.2)), axisAngle([0, 0, 1], -0.3)),
    )
    close(qmul(axisAngle([0, 1, 0], 0.5), qconj(axisAngle([0, 1, 0], 0.5))), [0, 0, 0, 1])
  })
  it('inverts a rigid transform', () => {
    const m: M = compose(euler(0.4, 1.1, -0.2), [0.3, -1, 2])
    close(mmul(m, invertRigid(m)), IDENTITY)
    const p: V3 = [0.5, 0.25, -1]
    close(apply(invertRigid(m), apply(m, p)), p)
  })
  it('normalizes the zero vector to zero instead of NaN', () => {
    close(normalize([0, 0, 0]), [0, 0, 0])
  })
  it('hashes integers to the same noise in [0, 1) as the source', () => {
    // Values from FigureBuilder's math.ts at a1f7246, run on Node 24.
    expect([0, 1, 2, 12345].map(hash)).toEqual([
      0, 0.034617292461916804, 0.5923021989874542, 0.5748658690135926,
    ])
  })
})
