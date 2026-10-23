// The Language group's words and names (Owner, 2026-10-18; FloorFifty `i18n/locales.ts` at a28dc44, generalised): each
// language is named in its own language, so a player finds theirs whatever the game is showing now.

/** Every word the Language group shows besides the languages' own names, in the game's language. */
export interface LanguageCopy {
  readonly title: string
  /** The choice that follows the host and the browser (`Locale.set(null)`). */
  readonly automatic: string
}

/**
 * A language's name in its own language ("日本語" for `ja`), from the browser's `Intl.DisplayNames`. An engine without
 * it, or a tag it cannot name, gives the tag back, so the picker never shows nothing.
 */
export function endonymOf(tag: string): string {
  try {
    const name = new Intl.DisplayNames([tag], { type: 'language' }).of(tag)
    if (name === undefined || name === tag) return tag
    // Some engines start a name in lower case ("español"); a picker shows it as a name.
    return name.charAt(0).toLocaleUpperCase(tag) + name.slice(1)
  } catch {
    return tag
  }
}
