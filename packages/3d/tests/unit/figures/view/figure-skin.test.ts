import { describe, expect, it } from 'vitest'
import type { Weight } from '#src/features/figures/body/mesh.ts'
import { restInverses, skinPart } from '#src/features/figures/view/figure-skin.ts'
import { axisAngle, compose, IDENTITY, type M, type V3 } from '#src/shared/math/math.ts'

// Two joints at rest at (0, 1, 0) and (0, 2, 0); one vertex on each and one between them.
const rest: V3[] = [
  [0, 1, 0],
  [0, 2, 0],
]
const positions = new Float32Array([1, 1, 0, 1, 2, 0, 1, 1.5, 0])
const normals = new Float32Array([1, 0, 0, 1, 0, 0, 1, 0, 0])
const weights: Weight[][] = [
  [[0, 1]],
  [[1, 1]],
  [
    [0, 0.5],
    [1, 0.5],
  ],
]
const atRest: M[] = rest.map((p) => compose([0, 0, 0, 1], p))

function skinned(world: M[]) {
  const out = { positions: new Float32Array(9), normals: new Float32Array(9) }
  skinPart({ positions, normals }, weights, world, restInverses(rest), out)
  return out
}

describe('skinPart', () => {
  it('leaves every vertex where it is at the rest pose', () => {
    const out = skinned(atRest)
    expect([...out.positions]).toEqual([...positions])
    expect([...out.normals]).toEqual([...normals])
  })

  it('moves a vertex weighted to one joint with that joint, and one weighted half and half to the midpoint', () => {
    // Joint 1 lifted 1 m: its vertex follows; the shared vertex moves half as far.
    const out = skinned([atRest[0] ?? IDENTITY, compose([0, 0, 0, 1], [0, 3, 0])])
    expect([...out.positions.slice(0, 3)]).toEqual([1, 1, 0])
    expect([...out.positions.slice(3, 6)]).toEqual([1, 3, 0])
    expect(out.positions[7]).toBeCloseTo(2)
  })

  it('turns normals with their joint and never moves them', () => {
    // Joint 0 turned 90° about y, in place: +x turns to −z; joint 1's normal is unchanged.
    const turned = compose(axisAngle([0, 1, 0], Math.PI / 2), [0, 1, 0])
    const out = skinned([turned, atRest[1] ?? IDENTITY])
    expect(out.normals[0]).toBeCloseTo(0)
    expect(out.normals[2]).toBeCloseTo(-1)
    expect([...out.normals.slice(3, 6)]).toEqual([1, 0, 0])
    // The vertex on joint 0 swings around it: (1, 1, 0) → (0, 1, −1).
    expect(out.positions[0]).toBeCloseTo(0)
    expect(out.positions[2]).toBeCloseTo(-1)
  })
})
