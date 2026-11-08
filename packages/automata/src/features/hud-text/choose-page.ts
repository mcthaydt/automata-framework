import type { PageChars, PageId } from './pages.ts'

// French typing puts a narrow no-break space (U+202F) before ! ? : and ;, and Geist has neither it nor the thin
// space (U+2009); the no-break space is the nearest one it has.
const NARROW_SPACES = /[  ]/g
// Control characters and invisible format characters (the soft hyphen U+00AD among them) draw nothing, and Geist
// has no glyph for some of them, so they are dropped rather than sent to a page that would lose the string.
const INVISIBLE = /[\p{Cc}\p{Cf}]/gu

/** The string as the label draws it: narrow spaces widened, invisible characters removed. Nothing else is skipped. */
export function normalise(text: string): string {
  return text.replace(NARROW_SPACES, ' ').replace(INVISIBLE, '')
}

/**
 * The first page whose characters cover the whole string (as `normalise` leaves it), or `undefined` (the fallback
 * draws it). Normalising again is harmless, so a caller may pass either form.
 */
export function choosePage(text: string, pages: readonly PageChars[]): PageId | undefined {
  const letters = [...normalise(text)]
  for (const page of pages) {
    const covered = new Set(page.chars)
    if (letters.every((ch) => covered.has(ch))) return page.id
  }
  return undefined
}

/** The code points no page holds, once each, in the order they appear. */
export function missingFrom(text: string, pages: readonly PageChars[]): string[] {
  const held = new Set(pages.flatMap((page) => [...page.chars]))
  return [...new Set([...normalise(text)].filter((ch) => !held.has(ch)))]
}
