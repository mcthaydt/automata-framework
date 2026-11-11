// A figure's cast shadow on the floor, as arithmetic: which floor cells the figure darkens. The picture part (the decal and
// its pass) is in the browser test; this is what it draws.
import { describe, expect, it } from 'vitest'
import {
  castShadow,
  type ShadowCast,
  type ShadowMark,
  type Silhouette,
} from '#src/shared/render/light/figure-shadow.ts'

/** A figure of `w` × `h` texels, all opaque, standing on its bottom row's middle, `metres` a texel, seen level (pitch 0). */
function slab(w = 20, h = 60, metres = 0.03): Silhouette {
  const rgba = new Uint8ClampedArray(w * h * 4)
  for (let k = 0; k < w * h; k++) rgba[k * 4 + 3] = 255
  return { width: w, height: h, rgba, anchor: [w / 2, h], metresPerTexel: metres, pitch: 0 }
}

/** A figure at the origin with its picture's right along +x (the camera looks along −z). */
const cast = (over: Partial<ShadowCast> = {}): ShadowCast => ({
  silhouette: slab(),
  at: [0, 0, 0],
  right: [1, 0],
  ...over,
})

/** The marked cells as world (x, z) points, the cell's centre. */
function marked(mark: ShadowMark): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = []
  for (let j = 0; j < mark.height; j++)
    for (let i = 0; i < mark.width; i++)
      if (mark.marks[j * mark.width + i]) {
        // The grid runs along the figure's right and toward the camera; the figure stands at the origin.
        const a = mark.originRight + (i + 0.5) * mark.texel
        const b = mark.originToward + (j + 0.5) * mark.texel
        out.push({ x: a * mark.right[0] + b * mark.toward[0], z: a * mark.right[1] + b * mark.toward[1] })
      }
  return out
}
const reach = (points: readonly { x: number; z: number }[], axis: 'x' | 'z', side: 1 | -1): number =>
  Math.max(...points.map((p) => side * p[axis]))

describe('a figure under no sun: its contact shadow', () => {
  it('is an ellipse under the feet, 0.3 m either side and 0.16 m toward and away from the camera', () => {
    const points = marked(castShadow(cast()))
    expect(points.length).toBeGreaterThan(0)
    expect(reach(points, 'x', 1)).toBeCloseTo(0.3, 1)
    expect(reach(points, 'x', -1)).toBeCloseTo(0.3, 1)
    expect(reach(points, 'z', 1)).toBeCloseTo(0.16, 1)
    expect(reach(points, 'z', -1)).toBeCloseTo(0.16, 1)
  })

  it('is also what a sun that does not shadow, or one too low to cast, leaves', () => {
    const level = marked(castShadow(cast({ sun: [1, 0.1, 0] })))
    expect(reach(level, 'x', 1)).toBeCloseTo(0.3, 1)
  })
})

describe('a figure under a sun that casts: the silhouette thrown along the sun', () => {
  it('falls away from the sun by the height times the sun’s lean: a sun at 45° on the left throws a 1.8 m figure 1.8 m to the right', () => {
    // 20 × 60 texels at 3 cm: 0.6 m wide, 1.8 m tall. The sun is toward −x and up: the shadow lies along +x.
    const points = marked(castShadow(cast({ sun: [-1, 1, 0] })))
    expect(reach(points, 'x', 1)).toBeCloseTo(1.8 + 0.3, 0)
    // Nothing falls toward the sun beyond the contact shadow and the figure's own half width.
    expect(reach(points, 'x', -1)).toBeCloseTo(0.3, 1)
  })

  it('falls straight under a sun overhead: no further than the figure is wide', () => {
    const points = marked(castShadow(cast({ sun: [0, 1, 0] })))
    expect(reach(points, 'x', 1)).toBeCloseTo(0.3, 1)
    expect(reach(points, 'z', 1)).toBeCloseTo(0.16, 1)
  })

  it('follows the figure’s right, not the world’s: seen from the side the same sun throws it toward the camera', () => {
    // The picture's right along +z: a sun toward −x lies along the picture's depth axis, away from the camera's right.
    const points = marked(castShadow(cast({ sun: [-1, 1, 0], right: [0, 1] })))
    // Toward the camera is the right turned a quarter: here −x, so a shadow along +x is away from the camera.
    expect(reach(points, 'z', 1)).toBeCloseTo(0.3, 1)
    expect(reach(points, 'x', 1)).toBeCloseTo(1.8 + 0.16, 0)
  })

  it('leaves no gap in a long shadow: a low sun’s shadow is one run of cells', () => {
    const mark = castShadow(cast({ sun: [-4, 1, 0] }))
    const row = Math.floor(mark.height / 2)
    const cells = Array.from({ length: mark.width }, (_, i) => mark.marks[row * mark.width + i] ?? 0)
    const first = cells.indexOf(1)
    const last = cells.lastIndexOf(1)
    expect(first).toBeGreaterThanOrEqual(0)
    expect(cells.slice(first, last + 1).every((c) => c === 1)).toBe(true)
  })

  it('is hidden where the floor is not: a floor that ends at the figure keeps the shadow off the far side', () => {
    // An up-facing plane covering x from 0 to 4, at the feet's height.
    const floor = { x: 2, y: 0, z: 0, normal: [0, 1, 0] as const, width: 4, height: 4 }
    const points = marked(castShadow(cast({ sun: [1, 1, 0] }), [floor]))
    expect(points.length).toBeGreaterThan(0)
    // The sun is on the right, so the shadow falls to −x, off the floor's edge: only the floor's side of the contact shadow stays.
    expect(Math.min(...points.map((p) => p.x))).toBeGreaterThanOrEqual(-0.04)
  })

  it('does not fall on a floor at another height', () => {
    const upstairs = { x: 0, y: 3, z: 0, normal: [0, 1, 0] as const, width: 10, height: 10 }
    const mark = castShadow(cast({ sun: [-1, 1, 0] }), [upstairs])
    expect(marked(mark)).toHaveLength(0)
  })
})
