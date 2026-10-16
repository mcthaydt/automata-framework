// Which of the game's locales a player sees (PRODUCT spec §4 item 2).
// Extracted from FloorFifty apps/client/src/i18n/detect.ts and strategy.ts (ac72660): there the six
// languages and their primary-subtag map were fixed; here the game's own locales are matched, exact tag first.

/** The candidates, best first; each is used only when the game has a matching locale. */
export interface LocaleCandidates {
  /** Ruken's `session.locale`, when the session is hosted. Standalone, the SDK's value is the browser's, so it is left out. */
  readonly hosted: string | undefined
  /** The player's own choice, saved by the language picker. */
  readonly saved: string | undefined
  /** The browser's languages, best first (`navigator.languages`). */
  readonly browser: readonly string[]
  /** The locales the game ships, in the game's spelling. */
  readonly locales: readonly string[]
  /** The game's default; one of `locales`. */
  readonly baseLocale: string
}

const primary = (tag: string): string => tag.split('-')[0] ?? tag

/**
 * The game's locale for a requested tag: the same tag (ignoring case), else the first locale with the same
 * primary language subtag. `fr-CA` finds `fr`; `pt` finds `pt-BR`. Undefined when the game lacks the language.
 */
export function matchLocale(requested: string, locales: readonly string[]): string | undefined {
  const wanted = requested.toLowerCase()
  const exact = locales.find((locale) => locale.toLowerCase() === wanted)
  if (exact !== undefined) return exact
  const language = primary(wanted)
  return locales.find((locale) => primary(locale.toLowerCase()) === language)
}

/**
 * The order is the spec's: Ruken's session locale, the saved choice, the browser's languages, the default.
 * Each step that names a language the game lacks falls through to the next, so a hosted `de` in a game
 * without German still honors the player's saved choice.
 */
export function negotiateLocale(candidates: LocaleCandidates): string {
  const requested = [
    ...(candidates.hosted === undefined ? [] : [candidates.hosted]),
    ...(candidates.saved === undefined ? [] : [candidates.saved]),
    ...candidates.browser,
  ]
  for (const tag of requested) {
    const match = matchLocale(tag, candidates.locales)
    if (match !== undefined) return match
  }
  return candidates.baseLocale
}
