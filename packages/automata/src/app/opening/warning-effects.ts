// What a game can say about itself in the photosensitivity warning. The game declares which of these it has, as data;
// the screen says them in the player's language from the word system, so a game that only flashes never tells its
// players it shakes, and a language is never left out of a safety notice.

/**
 * The effects a game can declare: `flashing` (lights that flash), `strobing` (lights that flash fast and repeatedly),
 * `shaking` (the screen shakes) and `patterns` (stripes, checks or other high-contrast patterns). Each has a word in
 * every language the framework ships (`first_run_warning_effects_<name>`).
 */
export const WARNING_EFFECTS = ['flashing', 'strobing', 'shaking', 'patterns'] as const

/** One of `WARNING_EFFECTS`. */
export type WarningEffect = (typeof WARNING_EFFECTS)[number]

/**
 * `effects` as one list in `locale`'s own way of joining ("flashing lights and a shaking screen"; Japanese and Chinese
 * join with their own marks). Where the runtime has no `Intl.ListFormat` the words are joined with commas.
 */
export function sayEffects(words: readonly string[], locale: string): string {
  if (typeof Intl !== 'undefined' && 'ListFormat' in Intl) {
    try {
      return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(words)
    } catch {
      // A tag the runtime cannot read: fall through to the plain join.
    }
  }
  return words.join(', ')
}
