import { describe, expect, it } from 'vitest'
import { lightPatchCorners, lightPatchPixels, patchShown } from '#src/shared/render/light/light-patch.ts'

// A patch of light on the floor: where a window's light lands, as stripes between the bars' shadows that fade away from the window.
// The room's baked light is per vertex and cannot draw a pattern a few centimetres across, so the patch is a picture laid on the floor:
// these are its geometry and its texels.

const patch = {
  id: 'moon',
  window: [0, 0] as const,
  centre: [0, 3] as const,
  width: 1.4,
  length: 4.6,
  bars: 4,
}

describe('where a patch lies', () => {
  it('is a rectangle across the line from the window to its middle, its first row at the window end', () => {
    const [a, b, c, d] = lightPatchCorners(patch)
    // The window is due north (z 0), the middle is 3 m south: the long side runs along z, centred on x 0 and on z 3.
    // It lies a hair above the floor, so the floor's depth does not fight it.
    expect(a[1]).toBeGreaterThan(0)
    expect(a[1]).toBeLessThan(0.03)
    expect([a[0], b[0], c[0], d[0]].map((x) => Math.abs(x))).toEqual([0.7, 0.7, 0.7, 0.7])
    expect(Math.min(a[2], b[2], c[2], d[2])).toBeCloseTo(3 - 2.3, 6)
    expect(Math.max(a[2], b[2], c[2], d[2])).toBeCloseTo(3 + 2.3, 6)
    // The first two corners are the window end (u = 0 then 1 at v = 0).
    expect(a[2]).toBeCloseTo(b[2], 6)
    expect(a[2]).toBeLessThan(c[2])
  })

  it('turns with the window: a window to the west casts along x', () => {
    const corners = lightPatchCorners({ ...patch, window: [-3, 0], centre: [0, 0] })
    const xs = corners.map((c) => c[0])
    expect(Math.min(...xs)).toBeCloseTo(-2.3, 6)
    expect(Math.max(...xs)).toBeCloseTo(2.3, 6)
    expect(Math.max(...corners.map((c) => Math.abs(c[2])))).toBeCloseTo(0.7, 6)
  })
})

describe('what a patch shows', () => {
  const { width, height, rgba } = lightPatchPixels(patch)
  const alphaAt = (x: number, y: number): number => rgba[(y * width + x) * 4 + 3] as number

  it('is stripes: a few clear columns across, equal bars between them, whatever the width', () => {
    const row = Array.from({ length: width }, (_, x) => alphaAt(x, 20) > 0)
    const bars: number[] = []
    let run = 0
    for (const on of [...row, false]) {
      if (on) run++
      else if (run > 0) {
        bars.push(run)
        run = 0
      }
    }
    expect(bars).toHaveLength(4)
    // The bars are the same width but for the edges, which fade in.
    expect(Math.max(...bars) - Math.min(...bars)).toBeLessThanOrEqual(2)
    // Texels are about 4.5 cm: a 1.4 m patch is about 31 across, 4.6 m about 102 long.
    expect(width).toBeGreaterThan(28)
    expect(width).toBeLessThan(34)
    expect(height).toBeGreaterThan(98)
    expect(height).toBeLessThan(106)
  })

  it('is brightest a little way from the window and fades to nothing at the far end', () => {
    const lit = (y: number) => Math.max(...Array.from({ length: width }, (_, x) => alphaAt(x, y)))
    expect(lit(0)).toBeLessThan(lit(12))
    expect(lit(12)).toBeGreaterThan(lit(60))
    expect(lit(60)).toBeGreaterThan(lit(height - 2))
    expect(lit(height - 1)).toBeLessThan(10)
  })

  it('is lighter with more gain, and takes the colour it is given', () => {
    const peak = (gain: number) => {
      const p = lightPatchPixels({ ...patch, gain, colour: '#96b2e1' })
      return Math.max(...Array.from({ length: p.width * p.height }, (_, i) => p.rgba[i * 4 + 3] as number))
    }
    expect(peak(0.85)).toBeGreaterThan(peak(0.5))
    expect(Array.from(rgba.slice(0, 3)).every((c) => c >= 0)).toBe(true)
    const sample = lightPatchPixels({ ...patch, colour: '#96b2e1' })
    const i = sample.rgba.findIndex((value, at) => at % 4 === 3 && value > 0)
    expect(Array.from(sample.rgba.slice(i - 3, i))).toEqual([0x96, 0xb2, 0xe1])
  })
})

describe('which rooms show a patch', () => {
  it('is every room for a patch that names none, and otherwise only while one of its rooms is drawn', () => {
    expect(patchShown(patch, new Set(['hall']))).toBe(true)
    expect(patchShown(patch, undefined)).toBe(true)
    const named = { ...patch, rooms: ['corridor'] }
    expect(patchShown(named, new Set(['hall']))).toBe(false)
    expect(patchShown(named, new Set(['hall', 'corridor']))).toBe(true)
    // No set says every room is drawn (a camera with no views).
    expect(patchShown(named, undefined)).toBe(true)
  })
})
