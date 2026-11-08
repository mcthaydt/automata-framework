import { describe, expect, it } from 'vitest'
import type { Rgba } from '#src/shared/assets/atlas-image.ts'
import { offPalettePixels } from '#src/shared/assets/palette-pixels.ts'
import type { Palette } from '#src/shared/palette/palette.ts'

// The palette check on atlas frames (M5 spec §4.7, §6; G-d).
// A pixel with alpha 0 carries no colour a player sees, so only drawn pixels are held to the palette.

const PALETTE: Palette = { name: 'two', colors: ['#000000', '#ff0040'] }

function image(pixels: readonly (readonly number[])[], width: number): Rgba {
  return { width, height: pixels.length / width, data: new Uint8Array(pixels.flat()) }
}

const BLACK = [0, 0, 0, 255]
const RED = [255, 0, 64, 255]
const CLEAR = [0, 0, 0, 0]

describe('offPalettePixels', () => {
  it('passes an image drawn only in palette colours', () => {
    expect(offPalettePixels(image([BLACK, RED, CLEAR, RED], 2), PALETTE)).toBeUndefined()
  })

  it('names the first stray pixel, its colour, and how many there are (G-d)', () => {
    const stray = [18, 52, 86, 255]
    expect(offPalettePixels(image([BLACK, RED, RED, stray, BLACK, stray], 3), PALETTE)).toEqual({
      count: 2,
      first: { x: 0, y: 1, color: '#123456' },
    })
  })

  it('ignores the colour under a fully transparent pixel', () => {
    expect(offPalettePixels(image([[18, 52, 86, 0], RED], 2), PALETTE)).toBeUndefined()
  })

  it('holds a half-transparent pixel to the palette', () => {
    expect(offPalettePixels(image([[18, 52, 86, 128]], 1), PALETTE)).toEqual({
      count: 1,
      first: { x: 0, y: 0, color: '#123456' },
    })
  })

  it('reads the palette in any letter case', () => {
    expect(
      offPalettePixels(image([RED], 1), { name: 'upper', colors: ['#FF0040', '#000000'] }),
    ).toBeUndefined()
  })
})
