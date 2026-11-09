import { describe, expect, it } from 'vitest'
import { type FinishLook, finishCell } from '#src/features/figures/cells/finish-cell.ts'
import type { PaintedCell } from '#src/features/figures/paint/paint-cell.ts'
import { DEFAULT_LOOK } from '#src/features/look/look.ts'
import { duel, RAMPS } from '#src/shared/math/duel.ts'

const look: FinishLook = DEFAULT_LOOK
const ramp = RAMPS[3] ?? []

function cell(): PaintedCell {
  const colours = new Uint8ClampedArray(4 * 4 * 4)
  for (let k = 0; k < 16; k++) {
    const c = k === 5 ? 0 : (ramp[k % 8] ?? 0)
    colours.set([c >> 16, (c >> 8) & 255, c & 255, k === 0 ? 0 : 255], k * 4)
  }
  return {
    width: 4,
    height: 4,
    feet: [2, 0],
    colours,
    normals: new Uint8ClampedArray(64),
    depth: new Float32Array(16),
    material: new Int16Array(16),
  }
}

describe('a lit cell on its way to the screen', () => {
  it('is its own colours with no haze', () => {
    const c = cell()
    expect(finishCell(c, [1, 1, 1], 0, [0, 0], look)).toBe(c.colours)
  })

  it('hazes toward the veil and lands on DUEL colours, leaving ink and empty texels', () => {
    const c = cell()
    const out = finishCell(c, [0.8, 0.8, 0.8], 0.5, [0, 0], look)
    expect(out).not.toBe(c.colours)
    const palette = new Set(RAMPS.flat())
    for (let k = 0; k < 16; k++) {
      const o = k * 4
      if (k === 0) {
        expect(out[o + 3]).toBe(0)
        continue
      }
      expect(out[o + 3]).toBe(255)
      const rgb = ((out[o] ?? 0) << 16) | ((out[o + 1] ?? 0) << 8) | (out[o + 2] ?? 0)
      if (k === 5) expect(rgb).toBe(0)
      else expect(palette.has(rgb) && rgb === duel(rgb)).toBe(true)
    }
  })

  it('a figure in one light repaints nothing', () => {
    const c = cell()
    const first = finishCell(c, [0.81, 0.8, 0.79], 0.5, [8, 12], look)
    // A light within one step, a haze within 1/32 and the same place on the Bayer grid.
    expect(finishCell(c, [0.8, 0.8, 0.8], 0.505, [4, 8], look)).toBe(first)
    // Another place on the grid, a light a step away or a clearly different haze is another array.
    expect(finishCell(c, [0.8, 0.8, 0.8], 0.5, [9, 12], look)).not.toBe(first)
    expect(finishCell(c, [0.95, 0.8, 0.8], 0.5, [8, 12], look)).not.toBe(first)
    expect(finishCell(c, [0.8, 0.8, 0.8], 0.6, [8, 12], look)).not.toBe(first)
  })

  it('hazes more the more share it is given', () => {
    const c = cell()
    const veil = (share: number): number => {
      const out = finishCell(c, [0.8, 0.8, 0.8], share, [0, 0], look)
      let green = 0
      for (let k = 1; k < 16; k++) green += out[k * 4 + 1] ?? 0
      return green
    }
    expect(veil(0.9)).not.toBe(veil(0.1))
  })
})
