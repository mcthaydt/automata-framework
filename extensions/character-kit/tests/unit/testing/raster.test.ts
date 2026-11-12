// The sheet tools' raster: a PNG written and read back is the same texels, a panel is blitted nearest-neighbour, and a label is
// drawn in the built-in font, so a sheet is made in Node with no canvas and no browser.
import { describe, expect, it } from 'vitest'
import { blit, decodePng, encodePng, fill, newRaster, text, textWidth } from '#src/testing/raster.ts'

describe('raster', () => {
  it('writes a PNG that reads back as the same texels', () => {
    const r = newRaster(3, 2)
    fill(r, 0, 0, 3, 2, [10, 20, 30, 255])
    r.data.set([200, 100, 50, 0], 4)
    const back = decodePng(encodePng(r))
    expect([back.w, back.h]).toEqual([3, 2])
    expect([...back.data]).toEqual([...r.data])
  })

  it('blits a source over the destination at a whole-number scale, transparent texels left alone', () => {
    const src = newRaster(2, 1)
    src.data.set([255, 0, 0, 255, 0, 0, 0, 0])
    const dst = newRaster(6, 3)
    fill(dst, 0, 0, 6, 3, [1, 2, 3, 255])
    blit(dst, src, 1, 1, 2)
    const px = (x: number, y: number) => [...dst.data.slice((y * 6 + x) * 4, (y * 6 + x) * 4 + 4)]
    expect(px(1, 1)).toEqual([255, 0, 0, 255])
    expect(px(2, 2)).toEqual([255, 0, 0, 255])
    expect(px(3, 1)).toEqual([1, 2, 3, 255])
    expect(px(0, 0)).toEqual([1, 2, 3, 255])
  })

  it('draws a label in ink where the font has a stroke, and measures it', () => {
    const r = newRaster(40, 12)
    text(r, 'AB 1', 1, 1, 1, [255, 255, 255, 255])
    expect(textWidth('AB 1', 1)).toBeGreaterThan(10)
    expect(r.data.some((v, i) => i % 4 === 0 && v === 255)).toBe(true)
  })

  it('has a glyph for every character a sheet label uses', () => {
    const r = newRaster(400, 12)
    for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 .,:-+×x/()=%'") {
      const one = newRaster(10, 10)
      text(one, ch, 0, 0, 1, [255, 255, 255, 255])
      const inked = one.data.some((v, i) => i % 4 === 3 && v !== 0)
      expect(inked || ch === ' ', `no glyph for "${ch}"`).toBe(true)
    }
    text(r, 'ok', 0, 0, 1, [1, 1, 1, 255])
  })
})
