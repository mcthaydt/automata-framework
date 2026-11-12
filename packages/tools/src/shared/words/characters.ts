import { create, type Font } from 'fontkit'
import type { Catalog } from './catalog.ts'

// What the `words` check needs to know about letters. `@automataframework/content` has the same two ideas
// (`fontCoverage` and `catalogCharacters`), but the tools run from source under plain Node, which cannot load
// content's assets or locale entries, and tools never imports content at run time. So these are tools' own, small
// copies, and a test keeps them equal to content's where they overlap.

/** Control characters draw nothing, so no font is asked for them. */
const CONTROL = /\p{Cc}/u

/** Whether a font file (TrueType, OpenType, woff or woff2) has a glyph for each character. */
export function fontCoverage(font: Uint8Array): (character: string) => boolean {
  // A font file holds one font; only a collection (`.ttc`) holds several, and a game's font is never one.
  const opened = create(Buffer.from(font)) as Font
  const held = new Set(opened.characterSet)
  return (character) => held.has(character.codePointAt(0) ?? 0)
}

/** Every character the catalog's messages show. `$schema` is the file's format, not text a player reads. */
export function catalogCharacters(catalog: Catalog): Set<string> {
  const characters = new Set<string>()
  for (const [key, text] of Object.entries(catalog)) {
    if (key === '$schema') continue
    // `for…of` walks code points, so a character outside the BMP is one entry, not two surrogates.
    for (const char of text) characters.add(char)
  }
  return characters
}

/**
 * Each character of `words` that none of the fonts can draw, once, with the first key that uses it. The fonts are
 * the ones serving one language: a game may stack faces, so a character any of them draws is drawn.
 */
export function undrawable(
  words: Catalog,
  covers: readonly ((character: string) => boolean)[],
): { key: string; character: string }[] {
  const found = new Map<string, string>()
  for (const [key, text] of Object.entries(words)) {
    if (key === '$schema') continue
    for (const character of text) {
      if (CONTROL.test(character) || found.has(character)) continue
      if (!covers.some((covers) => covers(character))) found.set(character, key)
    }
  }
  return [...found].map(([character, key]) => ({ key, character }))
}
