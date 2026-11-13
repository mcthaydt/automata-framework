import { describe, expect, it } from 'vitest'
import { LCD_CLINIC, LCD_OFF } from '#src/features/lcd-panel/lcd-profile.schema.ts'
import {
  LCD_SCREEN_CONSTANTS,
  lcdScreenGlsl,
  lcdScreenValues,
  lcdScreenWgsl,
  screenLight,
} from '#src/features/lcd-panel/lcd-screen.ts'

/** The light the mesh leaves on device pixel `x` of a row, with no row line: one number per column. */
const columnLight = (values: ReturnType<typeof lcdScreenValues>, x: number): number =>
  screenLight({ ...values, subpixels: 0 }, x, 0)[1]

describe('the panel at screen pixels', () => {
  it('draws one line on the last device pixel of each cell, phase 0 at the field origin, and none inside', () => {
    const values = lcdScreenValues(LCD_CLINIC, { cellPixels: 4 })
    const dark = Array.from({ length: 16 }, (_, x) => columnLight(values, x) < 1)
    expect(dark).toEqual(Array.from({ length: 16 }, (_, x) => x % 4 === 3))
    // A row line too, on the same lattice, and both darken the corner where they cross.
    expect(screenLight({ ...values, subpixels: 0 }, 0, 3)[1]).toBeLessThan(1)
    expect(screenLight({ ...values, subpixels: 0 }, 0, 2)[1]).toBe(1)
  })

  it('at scale 2 with a 4 px cell, no mesh line falls inside a texel of two field pixels that starts on an even one', () => {
    const values = lcdScreenValues(LCD_CLINIC, { cellPixels: 4 })
    const scale = 2
    // Every texel a figure placed with `grid: true` can have: two field pixels, starting on an even field pixel.
    for (let start = 0; start < 64; start += 2) {
      const first = start * scale
      const last = (start + 2) * scale - 1
      for (let x = first; x < last; x++) expect(columnLight(values, x), `device column ${x}`).toBe(1)
      for (let y = first; y < last; y++)
        expect(screenLight({ ...values, subpixels: 0 }, 0, y)[1], `device row ${y}`).toBe(1)
    }
  })

  it('makes each line as dark as the field mesh of the same strength at its darkest, never black', () => {
    const values = lcdScreenValues(LCD_CLINIC, { cellPixels: 4 })
    // The field's sinusoid of amplitude a runs from 1 + a to 1 - a: its trough keeps (1 - a) / (1 + a) of its peak.
    const ampColumns = 0.3 * 2 * (1 - LCD_CLINIC.balance)
    const ampRows = 0.3 * 2 * LCD_CLINIC.balance + 0.3
    expect(1 - values.lineColumns).toBeCloseTo((1 - ampColumns) / (1 + ampColumns), 6)
    expect(1 - values.lineRows).toBeCloseTo((1 - ampRows) / (1 + ampRows), 6)
    expect(values.lineRows).toBeLessThan(1)
  })

  it('splits the cell into red, green and blue columns that average to the plain colour, the line column left plain', () => {
    const values = lcdScreenValues({ ...LCD_OFF, subpixels: 0.3 }, { cellPixels: 4 })
    const tints = [0, 1, 2, 3].map((x) => screenLight(values, x, 0)[0])
    expect(tints[0]?.[0]).toBeGreaterThan(1)
    expect(tints[1]?.[1]).toBeGreaterThan(1)
    expect(tints[2]?.[2]).toBeGreaterThan(1)
    expect(tints[3]).toEqual([1, 1, 1])
    for (const channel of [0, 1, 2])
      expect(tints.slice(0, 3).reduce((sum, t) => sum + (t?.[channel] ?? 0), 0)).toBeCloseTo(3, 6)
  })

  it('is plain where the profile turns the mesh, stripes and scanlines off', () => {
    const values = lcdScreenValues(LCD_OFF, { cellPixels: 4 })
    for (let x = 0; x < 8; x++) expect(screenLight(values, x, x)).toEqual([[1, 1, 1], 1])
  })

  it('takes a cell of a whole number of device pixels, two or more', () => {
    expect(() => lcdScreenValues(LCD_CLINIC, { cellPixels: 1 })).toThrow(/cellPixels/)
    expect(() => lcdScreenValues(LCD_CLINIC, { cellPixels: 3.5 })).toThrow(/cellPixels/)
    expect(lcdScreenValues(LCD_CLINIC).cellPixels).toBe(4)
  })

  it('bakes the same numbers into its GLSL and WGSL, which read the screen uniforms the framework declares', () => {
    const values = lcdScreenValues(LCD_CLINIC, { cellPixels: 4 })
    const glsl = lcdScreenGlsl(values)
    const wgsl = lcdScreenWgsl(values)
    for (const name of LCD_SCREEN_CONSTANTS) {
      expect(glsl, `GLSL ${name}`).toContain(name)
      expect(wgsl, `WGSL ${name}`).toContain(name)
    }
    expect(glsl).toContain('uScreenOrigin')
    expect(wgsl).toContain('screen.uScreenOrigin')
    expect(glsl).toContain('const float CELL = 4.0;')
    expect(wgsl).toContain('const CELL: f32 = 4.0;')
  })
})
