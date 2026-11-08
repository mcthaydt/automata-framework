export type PageId = 'latin' | 'cyrillic'

export interface PageDef {
  readonly id: PageId
  readonly chars: string
}

const range = (from: number, to: number, skip: readonly number[] = []): string => {
  let out = ''
  for (let code = from; code <= to; code++) if (!skip.includes(code)) out += String.fromCodePoint(code)
  return out
}

const ASCII = range(0x20, 0x7e)
// The typographic punctuation both pages share: quotes, dashes, the ellipsis and the bullet.
const PUNCTUATION = '–—…•“”„‘’'

// Geist has no glyph for the soft hyphen (U+00AD); a string's soft hyphens are removed before a page is chosen.
const LATIN_1 = range(0xa0, 0xff, [0xad])

// A page lists every character it can draw. A character a baked font lacks does not fall back inside the font, it
// vanishes, so the chooser (in `@automata/framework`) must never send a string to a page that does not cover it.
export const PAGES: readonly PageDef[] = [
  {
    id: 'latin',
    chars:
      ASCII +
      LATIN_1 +
      // Œ œ; Polish; Turkish.
      'ŒœĄąĆćĘęŁłŃńŚśŹźŻż' +
      'ĞğİıŞş' +
      // ‚ ‹ › € ™ on top of the shared punctuation.
      PUNCTUATION +
      '‚‹›€™',
  },
  {
    id: 'cyrillic',
    chars:
      ASCII +
      // « » for Russian and Ukrainian quotation, then the shared punctuation, ʼ for Ukrainian words (м’яч, пʼять).
      '«»' +
      PUNCTUATION +
      'ʼ' +
      range(0x400, 0x45f) +
      // Ґ ґ and the numero sign.
      'Ґґ№',
  },
]
