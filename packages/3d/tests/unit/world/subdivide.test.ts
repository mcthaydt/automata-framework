// Subdivision keeps the builder's contract.
import { describe, expect, it } from 'vitest'
import { box, quad } from '#src/features/world/mesh.ts'
import { subdivide } from '#src/features/world/subdivide.ts'
import type { MeshData } from '#src/shared/math/geometry.ts'

const at = (m: MeshData, i: number): number[] => [
  m.positions[i * 3]!,
  m.positions[i * 3 + 1]!,
  m.positions[i * 3 + 2]!,
]
const dist = (a: number[], b: number[]): number => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!)
function edges(m: MeshData): number[] {
  const out: number[] = []
  for (let t = 0; t < m.indices.length; t += 3)
    for (let e = 0; e < 3; e++) out.push(dist(at(m, m.indices[t + e]!), at(m, m.indices[t + ((e + 1) % 3)]!)))
  return out
}
function area(m: MeshData): number {
  let sum = 0
  for (let t = 0; t < m.indices.length; t += 3) {
    const [a, b, c] = [0, 1, 2].map((e) => at(m, m.indices[t + e]!)) as [number[], number[], number[]]
    const u = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!]
    const v = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!]
    sum +=
      Math.hypot(
        u[1]! * v[2]! - u[2]! * v[1]!,
        u[2]! * v[0]! - u[0]! * v[2]!,
        u[0]! * v[1]! - u[1]! * v[0]!,
      ) / 2
  }
  return sum
}

describe('subdivision', () => {
  const meshes: Record<string, MeshData> = {
    wall: box([0, 0, 0], [6, 2.7, 0.16]),
    floor: quad([0, 0, 0], [6, 0, 0], [0, 0, -5]),
  }
  for (const [name, m] of Object.entries(meshes)) {
    const s = subdivide(m, 0.5)
    it(`${name}: no edge is longer than seg`, () =>
      expect(Math.max(...edges(s))).toBeLessThanOrEqual(0.5 + 1e-9))
    it(`${name}: the surface area is kept`, () =>
      expect(Math.abs(area(s) - area(m)) / area(m)).toBeLessThan(1e-9))
    it(`${name}: every normal is a unit vector, and the arrays agree`, () => {
      expect(s.normals.length).toBe(s.positions.length)
      for (let i = 0; i < s.normals.length; i += 3)
        expect(Math.hypot(s.normals[i]!, s.normals[i + 1]!, s.normals[i + 2]!)).toBeCloseTo(1, 9)
    })
    it(`${name}: seg 0 returns the mesh as it is`, () => expect(subdivide(m, 0)).toBe(m))
    it(`${name}: is deterministic`, () => expect(subdivide(m, 0.5)).toEqual(s))
  }
  it('keeps a mesh whose edges are already short', () => {
    const m = box([0, 0, 0], [0.2, 0.2, 0.2])
    expect(subdivide(m, 0.5).positions.length).toBe(m.positions.length)
  })
  it('leaves no crack: a shared edge is split once', () => {
    const s = subdivide(quad([0, 0, 0], [3, 0, 0], [0, 0, -3]), 0.5)
    const onDiagonal = new Map<string, number>()
    for (let i = 0; i < s.positions.length / 3; i++) {
      const p = at(s, i)
      if (Math.abs(p[0]! + p[2]!) < 1e-9 && p[0]! > 0 && p[0]! < 3) {
        const key = p.map((v) => v.toFixed(6)).join()
        onDiagonal.set(key, (onDiagonal.get(key) ?? 0) + 1)
      }
    }
    expect(onDiagonal.size).toBeGreaterThan(0)
    for (const count of onDiagonal.values()) expect(count).toBe(1)
  })
  it('refuses a seg so small the mesh would explode, by saying so', () => {
    expect(() => subdivide(quad([0, 0, 0], [100, 0, 0], [0, 0, -100]), 0.001)).toThrow(/triangles/)
  })
})
