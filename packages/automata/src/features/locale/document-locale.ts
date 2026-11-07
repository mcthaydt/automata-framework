// The document follows the locale.
// The `Locale` service calls this on boot and on every change, and `dir` is set too, so a
// right-to-left language lays out mirrored (with ui's logical properties).

/** ISO 15924 scripts written right to left (the ones CLDR's likely subtags produce, plus their peers). */
const RIGHT_TO_LEFT_SCRIPTS: ReadonlySet<string> = new Set([
  'Adlm',
  'Arab',
  'Hebr',
  'Mand',
  'Mend',
  'Nkoo',
  'Rohg',
  'Samr',
  'Syrc',
  'Thaa',
  'Yezi',
])

/**
 * Text direction from the locale's script: the explicit script subtag, else the likely one CLDR adds
 * (`ar` → `Arab`). Read from `Intl.Locale#maximize`, not `getTextInfo`, which not every engine has, so
 * every engine gives the same answer.
 */
export function textDirection(locale: string): 'ltr' | 'rtl' {
  const script = new Intl.Locale(locale).maximize().script
  return script !== undefined && RIGHT_TO_LEFT_SCRIPTS.has(script) ? 'rtl' : 'ltr'
}

/** `<html lang dir>`: the browser picks glyph forms and line breaking from `lang`, and the layout direction from `dir`. */
export function applyDocumentLocale(element: HTMLElement, locale: string): void {
  element.lang = locale
  element.dir = textDirection(locale)
}
