/// <reference path="./subset-font.d.ts" />
// Font subsetting and coverage (M5 spec §4.7 Fonts, M5-D7). Extracted from FloorFifty
// packages/asset-contract/tools/subset-fonts.ts (`subset-font` to woff2) and tests/client/i18n/fonts.test.ts
// (`fontkit` reading the subset back), at ac72660.
//
// Changed from FloorFifty: the characters are sorted by code point before they are joined, so the order a set
// was built in never reaches the subsetter, and the bytes depend only on the source and the characters (G-a).

// The reference above brings `subset-font`'s type into any program that compiles this file, not only this
// package's own (the consumer typecheck tests compile `src/` from outside it).
import { create, type Font } from 'fontkit'
import subsetFont from 'subset-font'

const byCodePoint = (a: string, b: string): number => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0)

/** The font cut to `characters`, as woff2. A character the font lacks is simply not in the subset. */
export async function subsetWoff2(source: Uint8Array, characters: ReadonlySet<string>): Promise<Uint8Array> {
  const text = [...characters].sort(byCodePoint).join('')
  // fontverter, inside `subset-font`, reads the format from a Buffer's string form, so a plain Uint8Array fails.
  return new Uint8Array(await subsetFont(Buffer.from(source), text, { targetFormat: 'woff2' }))
}

/** Whether a font file (TrueType, OpenType, woff or woff2) has a glyph for each character. */
export function fontCoverage(font: Uint8Array): (character: string) => boolean {
  // A font file holds one font; only a collection (`.ttc`) holds several, and the asset build never cuts one.
  const opened = create(Buffer.from(font)) as Font
  const held = new Set(characterSet(opened))
  return (character) => held.has(character.codePointAt(0) ?? 0)
}

/**
 * The code points the font maps. A subset cut to characters its source has none of keeps an empty `cmap`
 * table, which fontkit cannot read: that subset holds nothing. Any other failure is a broken file, and throws.
 */
function characterSet(font: Font): readonly number[] {
  try {
    return font.characterSet
  } catch (error) {
    if (error instanceof Error && error.message === 'Could not find a supported cmap table') return []
    throw error
  }
}
