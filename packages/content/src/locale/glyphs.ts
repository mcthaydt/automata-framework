// The characters each locale's text can contain (PRODUCT spec §4 item 6). Extracted from FloorFifty
// tools/i18n/characters.ts and the `visibleTexts` half of tools/i18n/catalogue.ts (ac72660).
//
// `catalogCharacters` is what a coverage check holds a subset font to; `localeCharacters` is what the
// font-subsetting asset build (M5) cuts a subset to: the catalog plus the ranges a typed name or a later string
// most likely needs. Some of those code points are unassigned, so a subset holds only the ones its font has.
//
// Changed from FloorFifty: it reads a catalog value, not a file; content catalogs are plain text
// (`checkTranslation` refuses anything else), so every character of every message counts.

import type { MessageCatalog } from './messages'

const range = (from: number, to: number): string[] =>
  Array.from({ length: to - from + 1 }, (_, index) => String.fromCodePoint(from + index))

/** Printable ASCII, CJK symbols and punctuation, half- and full-width forms, and the symbols the UI draws. */
export const ALWAYS_CHARACTERS: readonly string[] = [
  ...range(0x20, 0x7e),
  ...range(0x3000, 0x303f),
  ...range(0xff00, 0xffef),
  '…',
  '—',
  '·',
  '←',
  '→',
  '✓',
  '×',
]

/** Every character the catalog's messages show. `$schema` is the file's format, not text a player reads. */
export function catalogCharacters(catalog: MessageCatalog): Set<string> {
  const characters = new Set<string>()
  for (const [key, text] of Object.entries(catalog)) {
    if (key === '$schema') continue
    // `for…of` walks code points, so a character outside the BMP is one entry, not two surrogates.
    for (const char of text) characters.add(char)
  }
  return characters
}

/** What a locale's subset font is cut to: `ALWAYS_CHARACTERS` and the catalog's characters. */
export function localeCharacters(catalog: MessageCatalog): Set<string> {
  return new Set([...ALWAYS_CHARACTERS, ...catalogCharacters(catalog)])
}
