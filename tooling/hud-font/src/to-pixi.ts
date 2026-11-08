import type { BitmapFontData } from 'pixi.js'
import type { PageId } from './pages.ts'

/** The part of `msdf-bmfont-xml`'s JSON output this tool reads. */
export interface MsdfBmfontJson {
  pages: string[]
  chars: {
    id: number
    char: string
    width: number
    height: number
    xoffset: number
    yoffset: number
    xadvance: number
    x: number
    y: number
    page: number
  }[]
  info: { face: string; size: number }
  common: { lineHeight: number; base: number; scaleW: number; scaleH: number; pages: number }
  distanceField?: { fieldType: string; distanceRange: number }
  kernings?: { first: number; second: number; amount: number }[]
}

/**
 * Pixi's `BitmapFontData` from a bake, as Pixi's own XML reader builds it (`bitmapFontXMLParser`): the baseline is
 * measured from the line's top, and a kerning pair hangs on the second glyph, keyed by the first glyph's letter.
 */
export const toPixiFont = (json: MsdfBmfontJson, page: PageId): BitmapFontData => {
  const field = json.distanceField
  if (field?.fieldType !== 'msdf') {
    throw new Error('not an MSDF bake: the output has no msdf distanceField (the txt format drops it)')
  }
  if (json.common.pages !== 1 || json.pages.length !== 1) {
    throw new Error(
      `more than one atlas: ${json.common.pages} pages; shrink the charset or enlarge the texture`,
    )
  }
  const letters = new Map<number, string>()
  const chars: BitmapFontData['chars'] = {}
  for (const c of json.chars) {
    letters.set(c.id, c.char)
    chars[c.char] = {
      id: c.id,
      letter: c.char,
      page: 0,
      x: c.x,
      y: c.y,
      width: c.width,
      height: c.height,
      xOffset: c.xoffset,
      yOffset: c.yoffset,
      xAdvance: c.xadvance,
      kerning: {},
    }
  }
  for (const k of json.kernings ?? []) {
    const first = letters.get(k.first)
    const second = letters.get(k.second)
    if (k.amount === 0 || first === undefined || second === undefined) continue
    const glyph = chars[second]
    if (glyph) glyph.kerning[first] = k.amount
  }
  return {
    baseLineOffset: json.common.lineHeight - json.common.base,
    chars,
    pages: [{ id: 0, file: `${page}.png` }],
    lineHeight: json.common.lineHeight,
    fontSize: json.info.size,
    fontFamily: `af-hud-${page}`,
    distanceField: { type: 'msdf', range: field.distanceRange },
  }
}
