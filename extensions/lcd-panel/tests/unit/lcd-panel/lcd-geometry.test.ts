import { describe, expect, it } from 'vitest'
import {
  derivePitch,
  lcdUniformValues,
  smoothstep,
  vignetteShade,
} from '#src/features/lcd-panel/lcd-geometry.ts'
import { LCD_CLINIC, LCD_OFF } from '#src/features/lcd-panel/lcd-profile.schema.ts'

describe('derivePitch', () => {
  it('takes two 2-pixel cells for a 3-pixel minimum, a 4-pixel period, fully visible', () => {
    expect(derivePitch(2, 3)).toEqual({ cells: 2, cyclesPerPixel: 0.25, fade: 1 })
  })

  it('never goes under one cell, and a ratio of exactly one does not round up to two', () => {
    expect(derivePitch(3, 3).cells).toBe(1)
    expect(derivePitch(1, 3).cells).toBe(3)
  })

  it('fades the mesh out past Nyquist (a period of 2 pixels is gone)', () => {
    expect(derivePitch(2, 2).fade).toBe(0)
    expect(derivePitch(2, 2).cells).toBe(1)
  })
})

describe('smoothstep', () => {
  it('matches the shader: 0 below, 1 above, 0.5 in the middle', () => {
    expect(smoothstep(0.34, 0.5, 0.3)).toBe(0)
    expect(smoothstep(0.34, 0.5, 0.6)).toBe(1)
    expect(smoothstep(0, 1, 0.5)).toBe(0.5)
  })
})

describe('vignetteShade', () => {
  it('is clear inside, 0.667 at the edge of the ellipse and near black at the corners', () => {
    expect(vignetteShade(0.3)).toBe(0)
    expect(vignetteShade(0.82)).toBeCloseTo(0.667, 6)
    expect(vignetteShade(1)).toBeCloseTo(0.933, 6)
    expect(vignetteShade(2)).toBeCloseTo(0.933, 6)
  })
})

describe('lcdUniformValues', () => {
  it('turns the profile into the numbers the shader reads', () => {
    expect(lcdUniformValues(LCD_CLINIC, 1)).toMatchObject({
      uCellSize: 2,
      uCells: 2,
      uCyclesPerPixel: 0.25,
      uFade: 1,
      uGrid: 0.3,
      uLayout: 0,
      uSnap: 0,
      uVignette: 1,
      uBrightness: 1.55,
    })
  })

  it('scales the cell, so a coarser field keeps its mesh on its own grid', () => {
    expect(lcdUniformValues(LCD_CLINIC, 2)).toMatchObject({ uCellSize: 4, uCells: 1, uCyclesPerPixel: 0.25 })
  })

  it('reads bgr as 1 and a crisp snap as 1', () => {
    expect(lcdUniformValues({ ...LCD_CLINIC, layout: 'bgr', snap: true }, 1)).toMatchObject({
      uLayout: 1,
      uSnap: 1,
    })
  })

  it('has no vignette when the profile says so', () => {
    expect(lcdUniformValues({ ...LCD_OFF, vignette: false }, 1).uVignette).toBe(0)
  })
})
