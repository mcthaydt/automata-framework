import { describe, expect, it } from 'vitest'
import {
  LCD_CLINIC,
  LCD_OFF,
  lcdProfileSchema,
  parseLcdProfile,
} from '#src/features/lcd-panel/lcd-profile.schema.ts'

describe('the LCD profile', () => {
  it('has the clinic numbers when nothing is given', () => {
    expect(parseLcdProfile({})).toEqual({
      grid: 0.3,
      balance: 0.6,
      minPitch: 3,
      subpixels: 0.3,
      layout: 'rgb',
      scanlines: 0.3,
      aberration: 0.25,
      glow: 0.3,
      glowThreshold: 0.55,
      glowRadius: 1.5,
      brightness: 1.55,
      gamma: 1,
      cell: 2,
      snap: false,
      vignette: true,
    })
    expect(LCD_CLINIC).toEqual(parseLcdProfile({}))
  })

  it('keeps what a game sets and fills the rest', () => {
    expect(parseLcdProfile({ grid: 0.1, layout: 'bgr' })).toMatchObject({
      grid: 0.1,
      layout: 'bgr',
      glow: 0.3,
    })
  })

  it('names the setting that is out of range, in words', () => {
    const result = lcdProfileSchema.safeParse({ grid: 2 })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['grid'])
  })

  it('refuses a setting it does not know, so a typo is not silently ignored', () => {
    expect(() => parseLcdProfile({ scanline: 0.5 })).toThrow()
  })

  it('refuses a cell under one pixel', () => {
    expect(() => parseLcdProfile({ cell: 0 })).toThrow()
  })

  it('off keeps the vignette and zeroes every term that changes the picture', () => {
    expect(LCD_OFF).toMatchObject({
      grid: 0,
      subpixels: 0,
      scanlines: 0,
      aberration: 0,
      glow: 0,
      brightness: 1,
      gamma: 1,
      vignette: true,
    })
  })
})
