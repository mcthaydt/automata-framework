import { describe, expect, it } from 'vitest'
import { formatDuration, formatNumber, formatPercent, pluralCategory, selectPlural } from './format.js'

describe('format (PRODUCT spec §4 item 3)', () => {
  it("writes numbers in the reader's convention", () => {
    expect(formatNumber('de', 1234.5)).toBe('1.234,5')
    expect(formatNumber('en', 1234.5)).toBe('1,234.5')
  })

  it('writes whole percentages, with the locale spacing before the sign', () => {
    expect(formatPercent('en', 0.5)).toBe('50%')
    // French puts a no-break space before the sign; which one (U+00A0 or U+202F) depends on the ICU data.
    expect(formatPercent('fr', 0.5)).toMatch(/^50[\u00a0\u202f]%$/)
  })

  it('writes a duration as a clock, with hours only when there are any', () => {
    expect(formatDuration('en', 75_000)).toBe('01:15')
    expect(formatDuration('en', 3_725_000)).toBe('1:02:05')
    expect(formatDuration('en', 75_999)).toBe('01:15')
  })

  it('answers the plural and ordinal category for a count', () => {
    expect(pluralCategory('en', 1)).toBe('one')
    expect(pluralCategory('en', 2)).toBe('other')
    expect(pluralCategory('en', 2, 'ordinal')).toBe('two')
    expect(pluralCategory('en', 23, 'ordinal')).toBe('few')
  })

  it("selects the form for a count, falling back to 'other'", () => {
    // French zero is singular, English zero is plural.
    expect(selectPlural('fr', 0, { one: 'vie', other: 'vies' })).toBe('vie')
    expect(selectPlural('en', 0, { one: 'life', other: 'lives' })).toBe('lives')
    expect(selectPlural('ar', 3, { one: 'x', other: 'y' })).toBe('y')
  })
})
