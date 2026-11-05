// Numbers, durations and plurals in the reader's convention, through Intl.
// Extracted from FloorFifty apps/client/src/i18n/format.ts (ac72660), which read the active locale itself;
// here the locale is an argument, so these stay pure and the `Locale` service passes `current`.
// Words such as ordinal suffixes belong in messages: Intl gives the category, the catalog gives the text.

/** A number in `locale`'s convention (Intl.NumberFormat with `options`). */
export const formatNumber = (locale: string, value: number, options?: Intl.NumberFormatOptions): string =>
  new Intl.NumberFormat(locale, options).format(value)

/** A whole percentage of a fraction: 0.5 → `50%` (`50 %` in French). */
export const formatPercent = (locale: string, fraction: number): string =>
  formatNumber(locale, fraction, { style: 'percent', maximumFractionDigits: 0 })

/**
 * A clock-style duration from milliseconds, whole seconds: `01:15`, or `1:02:05` once there are hours.
 * Each part is a locale number (Arabic-Indic digits in `ar-EG`); the separator is a colon. NumberFormat, not
 * Intl.DurationFormat, so it needs no ES2025 lib in a game's tsconfig and runs on engines without it.
 */
export function formatDuration(locale: string, milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const twoDigits = new Intl.NumberFormat(locale, { minimumIntegerDigits: 2, useGrouping: false })
  const clock = [twoDigits.format(Math.floor(totalSeconds / 60) % 60), twoDigits.format(totalSeconds % 60)]
  return (hours > 0 ? [formatNumber(locale, hours, { useGrouping: false }), ...clock] : clock).join(':')
}

/**
 * A moment as a date and a short time in the reader's convention, in the reader's zone unless `options.timeZone`
 * names one (a test names UTC). A save's time on the slot list is this.
 */
export const formatDateTime = (
  locale: string,
  epochMs: number,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
): string =>
  new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', ...options }).format(epochMs)

/** The CLDR plural (or, with 'ordinal', ordinal) category of a count: one, two, few, many, zero or other. */
export const pluralCategory = (
  locale: string,
  count: number,
  type: Intl.PluralRuleType = 'cardinal',
): Intl.LDMLPluralRule => new Intl.PluralRules(locale, { type }).select(count)

/** The form for a count. A category the caller did not give falls back to `other`, which is required. */
export function selectPlural(
  locale: string,
  count: number,
  forms: Partial<Record<Intl.LDMLPluralRule, string>> & { readonly other: string },
): string {
  return forms[pluralCategory(locale, count)] ?? forms.other
}
