// The Language group's words and names (Owner, 2026-10-18; FloorFifty `i18n/locales.ts` at a28dc44, generalised): each
// language is named in its own language, so a player finds theirs whatever the game is showing now.
//
// `endonymOf` is content's (`@automataframework/automata-content/locale`): the font build cuts the same names into
// every subset, so there is one function for both, and ui re-exports it unchanged.

export { endonymOf } from '@automataframework/automata-content/locale'

/** Every word the Language group shows besides the languages' own names, in the game's language. */
export interface LanguageCopy {
  readonly title: string
  /** The choice that follows the host and the browser (`Locale.set(null)`). */
  readonly automatic: string
}
