/// <reference path="./subset-font.d.ts" />
// Font subsetting and coverage. `subset-font` cuts to woff2 and
// `fontkit` reads the subset back.
//
// The characters are sorted by code point before they are joined, so the order a set
// was built in never reaches the subsetter, and the bytes depend only on the source and the characters (G-a).

// The reference above brings `subset-font`'s type into any program that compiles this file, not only this
// package's own (the consumer typecheck tests compile `src/` from outside it).
import { create, type Font } from 'fontkit'
import subsetFont from 'subset-font'
import { NAME_IDS, renameFamily } from './font-rename.ts'

const byCodePoint = (a: string, b: string): number => (a.codePointAt(0) ?? 0) - (b.codePointAt(0) ?? 0)

/** The new family name for a subset of a font whose licence reserves its name, and the name it reserves. */
export interface FontRename {
  readonly family: string
  readonly reservedName: string
}

/**
 * The font cut to `characters`, as woff2. A character the font lacks is simply not in the subset. With `rename`, the
 * cut keeps the font's copyright and licence records, takes the new family name and drops any other record that names
 * the reserved one: it is cut to an sfnt, its `name` table is rewritten, and it is cut again to woff2 with the same
 * characters, which converts it and changes no glyph.
 */
export async function subsetWoff2(
  source: Uint8Array,
  characters: ReadonlySet<string>,
  rename?: FontRename,
): Promise<Uint8Array> {
  const text = [...characters].sort(byCodePoint).join('')
  // fontverter, inside `subset-font`, reads the format from a Buffer's string form, so a plain Uint8Array fails.
  if (rename === undefined)
    return new Uint8Array(await subsetFont(Buffer.from(source), text, { targetFormat: 'woff2' }))
  const sfnt = await subsetFont(Buffer.from(source), text, {
    targetFormat: 'sfnt',
    preserveNameIds: NAME_IDS,
  })
  const renamed = renameFamily(sfnt, rename.family, rename.reservedName)
  return new Uint8Array(
    await subsetFont(Buffer.from(renamed), text, { targetFormat: 'woff2', preserveNameIds: NAME_IDS }),
  )
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
