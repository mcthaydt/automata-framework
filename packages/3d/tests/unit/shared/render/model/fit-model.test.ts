// A model fitted to the box a prop stands in: base centre at the prop's origin, scaled to `size` (or to its height when
// uniform), turned and moved where the prop is placed. A model faces +z in its file.
import { describe, expect, it } from 'vitest'
import { fitModelMesh } from '#src/shared/render/model/fit-model.ts'
import { fixtureBox } from '#src/testing/model/model-fixtures.ts'

/** A 2 × 1 × 1 model whose origin is not at its base: x 0…2, y 1…2, z 0…1. */
const model = fixtureBox([0, 1, 0], [2, 2, 1])
const bounds = (positions: Float32Array): { min: number[]; max: number[] } => {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < positions.length; i += 3)
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k] as number, positions[i + k] as number)
      max[k] = Math.max(max[k] as number, positions[i + k] as number)
    }
  return { min, max }
}
const place = { at: [5, 0.5, 7] as [number, number, number], turn: 0 }

describe('fitModelMesh', () => {
  it('stretches the model to the size: base centre on the prop’s origin, standing on its height', () => {
    const { positions } = fitModelMesh(model, { size: [1, 0.5, 4] }, place)
    const { min, max } = bounds(positions)
    expect(min.map((v) => Math.round(v * 1e6) / 1e6)).toEqual([4.5, 0.5, 5])
    expect(max.map((v) => Math.round(v * 1e6) / 1e6)).toEqual([5.5, 1, 9])
  })
  it('scales by height alone when uniform, so the model keeps its proportions', () => {
    const { positions } = fitModelMesh(model, { size: [9, 3, 9], uniform: true }, { at: [0, 0, 0], turn: 0 })
    const { min, max } = bounds(positions)
    expect(max[1]).toBeCloseTo(3, 6)
    expect(min[1]).toBeCloseTo(0, 6)
    expect((max[0] as number) - (min[0] as number)).toBeCloseTo(6, 6) // 2 m wide at 1 m tall → 6 m at 3 m
    expect((max[2] as number) - (min[2] as number)).toBeCloseTo(3, 6)
    expect((max[0] as number) + (min[0] as number)).toBeCloseTo(0, 6) // centred
  })
  it('turns the model about the prop’s origin, as a place turns its pieces', () => {
    const [x, , z] = [0, 1, 2].map((k) => k)
    expect([x, z]).toEqual([0, 2])
    const { positions } = fitModelMesh(model, { size: [2, 1, 1] }, { at: [0, 0, 0], turn: 90 })
    const { min, max } = bounds(positions)
    // A quarter turn swaps the extents: 2 m along x becomes 2 m along z.
    expect((max[0] as number) - (min[0] as number)).toBeCloseTo(1, 6)
    expect((max[2] as number) - (min[2] as number)).toBeCloseTo(2, 6)
  })
  it('carries the front (+z) to the way the prop faces: turn 90 faces +x', () => {
    const { normals, positions } = fitModelMesh(model, { size: [2, 1, 1] }, { at: [0, 0, 0], turn: 90 })
    // The model's +z face has the normal (0, 0, 1); after a turn of 90 it points +x.
    let found = false
    for (let i = 0; i < normals.length; i += 3)
      if (Math.abs((normals[i] as number) - 1) < 1e-6 && Math.abs(normals[i + 2] as number) < 1e-6)
        found = true
    expect(found).toBe(true)
    expect(positions.length).toBe(model.positions.length)
  })
  it('mirrors along x: the model is flipped and every triangle keeps the side it faced', () => {
    const plain = fitModelMesh(model, { size: [2, 1, 1] }, { at: [0, 0, 0], turn: 0 })
    const mirrored = fitModelMesh(model, { size: [2, 1, 1], mirror: true }, { at: [0, 0, 0], turn: 0 })
    expect(plain.positions[0]).toBeCloseTo(-(mirrored.positions[0] as number), 6)
    // How a triangle's winding sits against its vertex normal: the same sign in both, so a flipped model is not inside out.
    const facing = (fit: typeof plain): number[] => {
      const out: number[] = []
      for (let t = 0; t < fit.indices.length; t += 3) {
        const [a, b, c] = [0, 1, 2].map((k) => (fit.indices[t + k] as number) * 3) as [number, number, number]
        const p = fit.positions
        const u = [0, 1, 2].map((k) => (p[b + k] as number) - (p[a + k] as number))
        const v = [0, 1, 2].map((k) => (p[c + k] as number) - (p[a + k] as number))
        const winding = [
          (u[1] as number) * (v[2] as number) - (u[2] as number) * (v[1] as number),
          (u[2] as number) * (v[0] as number) - (u[0] as number) * (v[2] as number),
          (u[0] as number) * (v[1] as number) - (u[1] as number) * (v[0] as number),
        ]
        out.push(Math.sign(winding.reduce((sum, w, k) => sum + w * (fit.normals[a + k] as number), 0)))
      }
      return out
    }
    expect(facing(mirrored)).toEqual(facing(plain))
  })
  it('keeps the uvs and one index per index', () => {
    const fit = fitModelMesh(model, { size: [2, 1, 1] }, place)
    expect([...fit.uvs]).toEqual([...model.uvs])
    expect(fit.indices.length).toBe(model.indices.length)
  })
  it('leaves a flat model alone rather than dividing by nothing', () => {
    const flat = fixtureBox([0, 0, 0], [1, 0, 1])
    const { positions } = fitModelMesh(flat, { size: [1, 1, 1], uniform: true }, place)
    expect([...positions].every(Number.isFinite)).toBe(true)
  })
})
