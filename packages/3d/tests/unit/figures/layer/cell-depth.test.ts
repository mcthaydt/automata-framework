import { describe, expect, it } from 'vitest'
import { depthBytes } from '#src/features/figures/layer/cell-depth.ts'
import type { PaintedCell } from '#src/features/figures/paint/paint-cell.ts'
import { packDepth, packedDepthBytes, unpackDepth } from '#src/shared/render/alpha/alpha-codes.ts'

function cell(depth: number[], alpha: number[]): PaintedCell {
  const colours = new Uint8ClampedArray(alpha.length * 4)
  alpha.forEach((a, k) => {
    colours[k * 4 + 3] = a
  })
  return {
    width: alpha.length,
    height: 1,
    feet: [0, 0],
    colours,
    normals: new Uint8ClampedArray(alpha.length * 4),
    depth: Float32Array.from(depth),
    material: new Int16Array(alpha.length),
  }
}

/** The metres a packed texel stands for. */
const metresAt = (bytes: Uint8Array, k: number): number =>
  unpackDepth(((bytes[k * 4] ?? 0) << 8) | (bytes[k * 4 + 1] ?? 0))

describe('a cell’s depth for the composite pass', () => {
  it('packs each texel’s metres toward the camera into two bytes', () => {
    const bytes = depthBytes(cell([0.25, -0.5, 1], [255, 255, 255]))
    expect(Array.from(bytes.slice(0, 2))).toEqual(Array.from(packedDepthBytes(packDepth(0.25))))
    expect(metresAt(bytes, 1)).toBeCloseTo(-0.5, 3)
    expect(metresAt(bytes, 2)).toBeCloseTo(1, 3)
  })

  it('gives an outline texel with no depth of its own its nearest neighbour’s', () => {
    const bytes = depthBytes(cell([0.4, Number.NEGATIVE_INFINITY, 0.1], [255, 255, 255]))
    expect(metresAt(bytes, 1)).toBeCloseTo(0.4, 3)
  })

  it('keeps depths past the span on its ends and an empty texel flat', () => {
    const bytes = depthBytes(cell([9, Number.NEGATIVE_INFINITY], [255, 0]))
    expect(metresAt(bytes, 0)).toBeCloseTo(4, 3)
    expect(metresAt(bytes, 1)).toBeCloseTo(0, 3)
  })
})
