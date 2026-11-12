// A language's own name for itself (its endonym), as the language picker shows it (ui's `LanguageSection`, Owner,
// 2026-10-18) and as the font build cuts it into every
// language's subset, so the picker can draw every name whichever language the game is showing.
// One function for both: it lives here, in content's browser-safe entry, and ui re-exports it.
import { DEFAULT_LOCALES, type DefaultLocale, ENDONYMS } from './default-locales.ts'

const isDefault = (tag: string): tag is DefaultLocale => (DEFAULT_LOCALES as readonly string[]).includes(tag)

/**
 * A language's name in its own language ("日本語" for `ja`): the framework's own spelling for the six default
 * languages, otherwise the browser's `Intl.DisplayNames`. An engine without it, or a tag it cannot name, gives the tag
 * back, so the picker never shows nothing.
 */
export function endonymOf(tag: string): string {
  if (isDefault(tag)) return ENDONYMS[tag]
  try {
    const name = new Intl.DisplayNames([tag], { type: 'language' }).of(tag)
    if (name === undefined || name === tag) return tag
    // Some engines start a name in lower case ("español"); a picker shows it as a name.
    return name.charAt(0).toLocaleUpperCase(tag) + name.slice(1)
  } catch {
    return tag
  }
}
