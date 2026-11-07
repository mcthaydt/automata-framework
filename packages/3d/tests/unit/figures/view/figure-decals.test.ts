import { describe, expect, it } from 'vitest'
import type { Decal } from '#src/features/figures/body/mesh.ts'
import { FIGURE_PPM } from '#src/features/figures/body/texels.ts'
import { decalQuads } from '#src/features/figures/view/figure-decals.ts'
import { cross, dot, sub, type V3 } from '#src/shared/math/math.ts'

const eye: Decal = { bone: 5, at: [0.02, 0.1, 0.08], normal: [0, 0, 1], material: 'eye', size: [2, 3] }
const vertex = (p: Float32Array, i: number): V3 => [p[i * 3] ?? 0, p[i * 3 + 1] ?? 0, p[i * 3 + 2] ?? 0]

describe('decalQuads', () => {
  it('lays a neutral decal as one quad on its bone, centred on its point, its size in texels at the fixed ppm', () => {
    const [quad] = decalQuads([eye])
    if (quad === undefined) throw new Error('no quad')
    expect(quad.bone).toBe(5)
    expect(quad.material).toBe('eye')
    expect(quad.positions.length).toBe(12)
    expect([...quad.indices]).toEqual([0, 1, 2, 0, 2, 3])
    const corners = [0, 1, 2, 3].map((i) => vertex(quad.positions, i))
    const centre = corners.reduce((s, c) => [s[0] + c[0] / 4, s[1] + c[1] / 4, s[2] + c[2] / 4], [0, 0, 0])
    expect(centre[0]).toBeCloseTo(0.02)
    expect(centre[1]).toBeCloseTo(0.1)
    // Lifted off the surface a little along its normal, so it never fights the face it lies on.
    expect(centre[2]).toBeGreaterThan(0.08)
    expect(centre[2]).toBeLessThan(0.082)
    const [a, b, , d] = corners as [V3, V3, V3, V3]
    expect(Math.hypot(...sub(b, a))).toBeCloseTo(2 / FIGURE_PPM)
    expect(Math.hypot(...sub(d, a))).toBeCloseTo(3 / FIGURE_PPM)
  })

  it('winds each quad to face along its normal, so back-face culling hides it turned away from the camera', () => {
    for (const normal of [
      [0, 0, 1],
      [1, 0, 0],
      [0, 1, 0],
      [0, -0.6, -0.8],
    ] as V3[]) {
      const [quad] = decalQuads([{ ...eye, normal }])
      if (quad === undefined) throw new Error('no quad')
      const [a, b, c] = [0, 1, 2].map((i) => vertex(quad.positions, i)) as [V3, V3, V3]
      expect(dot(cross(sub(b, a), sub(c, a)), normal)).toBeGreaterThan(0)
      expect(vertex(quad.normals, 3)).toEqual(normal.map((v) => Math.fround(v)))
    }
  })

  it('draws a one-texel mark when the decal gives no size', () => {
    const { size: _size, ...unsized } = eye
    const [quad] = decalQuads([unsized])
    if (quad === undefined) throw new Error('no quad')
    const [a, b] = [0, 1].map((i) => vertex(quad.positions, i)) as [V3, V3]
    expect(Math.hypot(...sub(b, a))).toBeCloseTo(1 / FIGURE_PPM)
  })

  it('keeps only the neutral face: expression marks and blink marks are the clips’ (M3.6)', () => {
    const quads = decalQuads([
      eye,
      { ...eye, when: ['neutral', 'sad'] },
      { ...eye, when: ['fear', 'surprised'] },
      { ...eye, blink: true },
      { ...eye, when: ['neutral'], blink: false },
    ])
    expect(quads.length).toBe(3)
  })
})
