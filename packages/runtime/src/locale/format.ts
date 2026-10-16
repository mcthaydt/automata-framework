// Numbers, durations and plurals in the reader's convention, through Intl (PRODUCT spec §4 item 3).
// Extracted from FloorFifty apps/client/src/i18n/format.ts (ac72660), which read the active locale itself;
// here the locale is an argument, so these stay pure and the `Locale` service passes `current`.
// Words such as ordinal suffixes belong in messages: Intl gives the category, the catalog gives the text.

export const formatNumber = (locale: string, value: number, options?: Intl.NumberFormatOptions): string =>
  new Intl.NumberFormat(locale, options).format(value)

/** A whole percentage of a fraction: 0.5 → `50%` (`50 %` in French). */
export const formatPercent = (locale: string, fraction: number): string =>
  formatNumber(locale, fraction, { style: 'percent', maximumFractionDigits: 0 })

/** A clock-style duration from milliseconds, whole seconds: `01:15`, or `1:02:05` once there are hours. */
export function formatDuration(locale: string, milliseconds: number): string {
  const totalSeconds = Math.floor(milliseconds / 1000)
  const duration = {
    hours: Math.floor(totalSeconds / 3600),
    minutes: Math.floor(totalSeconds / 60) % 60,
    seconds: totalSeconds % 60,
  }
  return new Intl.DurationFormat(locale, { style: 'digital', hoursDisplay: 'auto' }).format(duration)
}

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
