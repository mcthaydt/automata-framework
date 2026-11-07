// The world's flat-faced primitives: one normal per face, and a
// triangle that winds the way its normal points, so a renderer may cull back faces.
import { describe, expect, it } from 'vitest'
import { box, quad } from '#src/features/world/mesh.ts'
import { type MeshData, merge } from '#src/shared/math/geometry.ts'

const at = (mesh: MeshData, i: number): number[] => mesh.positions.slice(i * 3, i * 3 + 3)

/** Every triangle's winding normal dotted with its vertex normal: positive when the winding faces the way the normal says. */
function facing(mesh: MeshData): number[] {
  const out: number[] = []
  for (let t = 0; t < mesh.indices.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map((e) => at(mesh, mesh.indices[t + e] as number)) as [
      number[],
      number[],
      number[],
    ]
    const u = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!]
    const v = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!]
    const w = [u[1]! * v[2]! - u[2]! * v[1]!, u[2]! * v[0]! - u[0]! * v[2]!, u[0]! * v[1]! - u[1]! * v[0]!]
    const n = mesh.normals.slice((mesh.indices[t] as number) * 3, (mesh.indices[t] as number) * 3 + 3)
    out.push(w[0]! * n[0]! + w[1]! * n[1]! + w[2]! * n[2]!)
  }
  return out
}

describe('quad', () => {
  it('has one unit normal, u × v, on every vertex', () => {
    const q = quad([0, 0, 0], [2, 0, 0], [0, 0, -3])
    for (let i = 0; i < q.normals.length; i += 3)
      for (const [k, want] of [0, 1, 0].entries()) expect(q.normals[i + k]).toBeCloseTo(want, 12)
  })
  it('is cut into n × m cells', () => {
    const q = quad([0, 0, 0], [4, 0, 0], [0, 2, 0], 4, 2)
    expect(q.positions.length / 3).toBe(5 * 3)
    expect(q.indices.length / 3).toBe(4 * 2 * 2)
  })
  it('winds the way its normal points', () => {
    for (const f of facing(quad([0, 0, 0], [2, 0, 0], [0, 0, -3], 2, 2))) expect(f).toBeGreaterThan(0)
  })
})

describe('box', () => {
  const b = box([1, 0, 2], [2, 3, 1])
  it('stands on its base’s centre with the size given', () => {
    const xs = b.positions.filter((_, i) => i % 3 === 0)
    const ys = b.positions.filter((_, i) => i % 3 === 1)
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([0, 2])
    expect([Math.min(...ys), Math.max(...ys)]).toEqual([0, 3])
  })
  it('winds every face outward', () => {
    for (const f of facing(b)) expect(f).toBeGreaterThan(0)
  })
  it('leaves out the faces it is told to', () => {
    expect(box([0, 0, 0], [1, 1, 1], ['-y', '+y']).positions.length).toBeLessThan(b.positions.length)
  })
})

describe('merge', () => {
  it('joins meshes and rebases the indices', () => {
    const m = merge(quad([0, 0, 0], [1, 0, 0], [0, 1, 0]), quad([0, 0, 1], [1, 0, 0], [0, 1, 0]))
    expect(m.positions.length / 3).toBe(8)
    expect(Math.max(...m.indices)).toBe(7)
  })
})
