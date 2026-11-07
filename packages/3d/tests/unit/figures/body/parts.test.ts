import { describe, expect, it } from 'vitest'
import { type Mesh, placed, vertexAt } from '#src/features/figures/body/mesh.ts'
import { reach } from '#src/features/figures/body/reach.ts'
import { J } from '#src/features/figures/body/rig.ts'
import { hemSkin, hemWeights, weights } from '#src/features/figures/body/skin-weights.ts'
import { FIGURE_PPM, texels } from '#src/features/figures/body/texels.ts'
import { limb } from '#src/shared/math/limb.ts'
import { dot, length, sub, type V3 } from '#src/shared/math/math.ts'
import { superquadric, tube } from '#src/shared/math/superquadric.ts'

const finite = (mesh: Mesh): boolean => [...mesh.positions, ...mesh.normals].every(Number.isFinite)
const sum = (pairs: readonly (readonly [number, number])[]): number =>
  pairs.reduce((total, [, weight]) => total + weight, 0)

describe('primitives (FigureBuilder parts.ts)', () => {
  it('a superquadric is a closed surface whose unit normals point out of its centre', () => {
    const mesh = superquadric({ at: [0.1, 0.2, 0], r: [0.1, 0.2, 0.05], e: [0.5, 0.55] })
    expect(finite(mesh)).toBe(true)
    // 7 rings of 10 around, two triangles a cell.
    expect(mesh.positions.length / 3).toBe(80)
    expect(mesh.indices.length).toBe(7 * 10 * 6)
    for (let i = 0; i < mesh.positions.length / 3; i++) {
      const p = vertexAt(mesh.positions, i)
      const n = vertexAt(mesh.normals, i)
      expect(length(n)).toBeCloseTo(1, 9)
      expect(dot(n, sub(p, [0.1, 0.2, 0]))).toBeGreaterThanOrEqual(0)
    }
  })
  it('a superquadric keeps only the triangles `keep` passes', () => {
    const whole = superquadric({ at: [0, 0, 0], r: [1, 1, 1] })
    const top = superquadric({ at: [0, 0, 0], r: [1, 1, 1], keep: (_x, y) => y > 0 })
    expect(top.indices.length).toBeGreaterThan(0)
    expect(top.indices.length).toBeLessThan(whole.indices.length)
  })
  it('a tube with an arc is open: one more column than its segments', () => {
    const closed = tube([1, 0.2, 0.15, 0], [0, 0.3, 0.2, 0], { seg: 12, rings: 4 })
    const open = tube([1, 0.2, 0.15, 0], [0, 0.3, 0.2, 0], { seg: 12, rings: 4, arc: [0.5, 2.5] })
    expect(closed.positions.length / 3).toBe(5 * 12)
    expect(open.positions.length / 3).toBe(5 * 13)
    expect(open.indices.length).toBe(closed.indices.length)
    expect(finite(open)).toBe(true)
  })
  it('a limb never swells past its keys (a monotone profile), and its span cuts it ring to ring', () => {
    const rings = [
      { y: 1, rx: 0.05, rz: 0.05 },
      { y: 0.6, rx: 0.08, rz: 0.07 },
      { y: 0.2, rx: 0.04, rz: 0.04 },
    ]
    const mesh = limb({ rings, seg: 12 })
    expect(finite(mesh)).toBe(true)
    for (let i = 0; i < mesh.positions.length / 3; i++) {
      const [x, , z] = vertexAt(mesh.positions, i)
      expect(Math.abs(x)).toBeLessThanOrEqual(0.08 + 1e-12)
      expect(Math.abs(z)).toBeLessThanOrEqual(0.07 + 1e-12)
    }
    const cut = limb({ rings, seg: 12, span: [0.8, 0.4] })
    const ys = Array.from({ length: cut.positions.length / 3 }, (_, i) => vertexAt(cut.positions, i)[1])
    expect(Math.max(...ys)).toBeCloseTo(0.8, 12)
    expect(Math.min(...ys)).toBeCloseTo(0.4, 12)
  })
  it('placed moves a mesh by a turn and an offset', () => {
    const a = superquadric({ at: [0, 0, 0], r: [1, 1, 1], seg: 4, rings: 2 })
    const b = placed(a, [2, 0, 0])
    expect(vertexAt(b.positions, 0)[0]).toBeCloseTo(vertexAt(a.positions, 0)[0] + 2, 12)
    expect(b.indices).toEqual(a.indices)
  })
})

describe('skin weights (FigureBuilder parts.ts)', () => {
  const mesh = tube([1, 0.2, 0.15, 0], [0.3, 0.3, 0.2, 0], { seg: 12, rings: 6 })
  it('weights maps each rest position to its bones', () => {
    const skin = weights(mesh, (_x, y) => [
      [J.pelvis, y],
      [J.chest, 1 - y],
    ])
    expect(skin).toHaveLength(mesh.positions.length / 3)
    for (const pairs of skin) expect(sum(pairs)).toBeCloseTo(1, 12)
  })
  it("a hem's weights ride the top bone at the waist and the thighs below, always summing to 1", () => {
    const skin = hemWeights(mesh, J.pelvis, J['thigh.L'], J['thigh.R'], 0.95, 0.3, 0.75, 0.3)
    for (const pairs of skin) expect(sum(pairs)).toBeCloseTo(1, 12)
    expect(skin[0]?.[0]).toEqual([J.pelvis, 1])
  })
  it("hemSkin hands a share of a leg's skin to its hem pivot toward the hem, keeping the sum", () => {
    const leg = (): [number, number][] => [
      [J['thigh.L'], 0.4],
      [J['shin.L'], 0.6],
    ]
    const skin = hemSkin(leg, J.hemL, 0.5, 0.1)
    expect(skin(0, 0.6)).toEqual([...leg(), [J.hemL, 0]])
    const atHem = skin(0, 0.1)
    expect(atHem.at(-1)).toEqual([J.hemL, 1])
    expect(sum(skin(0, 0.3))).toBeCloseTo(1, 12)
  })
})

describe('reach and texels', () => {
  it("reach finds how far out a part's surface lies along a ray from its bone", () => {
    const rest: V3[] = Array.from({ length: 27 }, (): V3 => [0, 0, 0])
    rest[J.chest] = [0, 1, 0]
    const part = {
      mesh: superquadric({ at: [0, 0, 0], r: [0.2, 0.2, 0.2], e: [0.2, 0.2], seg: 24, rings: 16 }),
      material: 'cloth',
      group: 0,
      bone: J.chest,
    }
    expect(reach([part], rest, [0, 1, 0], [1, 0, 0])).toBeCloseTo(0.2, 2)
    expect(reach([part], rest, [0, 3, 0], [1, 0, 0])).toBe(0)
  })
  it('texels holds a feature to whole texels at the fixed ppm, at least `least` of them', () => {
    expect(FIGURE_PPM).toBe(73.8)
    expect(texels(0.05)).toBeCloseTo(4 / 73.8, 12)
    expect(texels(0.001)).toBeCloseTo(1 / 73.8, 12)
    expect(texels(0.001, 2)).toBeCloseTo(2 / 73.8, 12)
  })
})
