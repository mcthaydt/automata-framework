import { describe, expect, it } from 'vitest'
import { type MsdfBmfontJson, toPixiFont } from '#src/to-pixi.ts'

const base = (): MsdfBmfontJson => ({
  pages: ['hud.png'],
  chars: [
    { id: 65, char: 'A', width: 25, height: 27, xoffset: -1, yoffset: 7, xadvance: 23, x: 0, y: 0, page: 0 },
    { id: 66, char: 'B', width: 22, height: 27, xoffset: 1, yoffset: 7, xadvance: 22, x: 26, y: 0, page: 0 },
  ],
  info: { face: 'Geist-SemiBold', size: 32 },
  common: { lineHeight: 42, base: 32, scaleW: 48, scaleH: 27, pages: 1 },
  distanceField: { fieldType: 'msdf', distanceRange: 4 },
  kernings: [
    { first: 65, second: 66, amount: -1 },
    { first: 66, second: 65, amount: 0 },
  ],
})

describe('toPixiFont', () => {
  it('keeps both glyphs and names the family after the page', () => {
    const font = toPixiFont(base(), 'latin')
    expect(Object.keys(font.chars)).toEqual(['A', 'B'])
    expect(font.fontFamily).toBe('af-hud-latin')
    expect(font.fontSize).toBe(32)
    expect(font.lineHeight).toBe(42)
  })

  it('keeps only the kerning pairs that are not zero, the way Pixi reads them', () => {
    const font = toPixiFont(base(), 'latin')
    // Pixi stores a pair on the second glyph, keyed by the first glyph's letter.
    expect(font.chars.B?.kerning).toEqual({ A: -1 })
    expect(font.chars.A?.kerning).toEqual({})
  })

  it('writes the distance field the way Pixi names it', () => {
    expect(toPixiFont(base(), 'latin').distanceField).toEqual({ type: 'msdf', range: 4 })
  })

  it('puts the baseline where Pixi puts it for a BMFont', () => {
    expect(toPixiFont(base(), 'latin').baseLineOffset).toBe(10)
  })

  it('refuses a bake with no distance field, because the text output drops it', () => {
    const json = base() as Partial<MsdfBmfontJson>
    delete json.distanceField
    expect(() => toPixiFont(json as MsdfBmfontJson, 'latin')).toThrow('not an MSDF bake')
  })

  it('refuses a bake that needed more than one atlas', () => {
    const json = base()
    json.common.pages = 2
    expect(() => toPixiFont(json, 'latin')).toThrow('more than one atlas')
  })
})
