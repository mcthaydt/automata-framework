import { describe, expect, it } from 'vitest'
import { matchLocale, negotiateLocale } from './negotiate-locale.js'

const locales = ['en', 'fr', 'pt-BR'] as const

describe('matchLocale', () => {
  it('prefers the exact tag, then the primary subtag', () => {
    expect(matchLocale('fr', locales)).toBe('fr')
    expect(matchLocale('fr-CA', locales)).toBe('fr')
    expect(matchLocale('pt', locales)).toBe('pt-BR')
    expect(matchLocale('de', locales)).toBeUndefined()
  })

  it("ignores case and answers in the game's own spelling", () => {
    expect(matchLocale('PT-br', locales)).toBe('pt-BR')
    expect(matchLocale('EN-us', locales)).toBe('en')
  })

  it('takes an exact regional tag over another region of the same language', () => {
    expect(matchLocale('pt-PT', ['pt-BR', 'pt-PT'])).toBe('pt-PT')
    expect(matchLocale('pt-AO', ['pt-BR', 'pt-PT'])).toBe('pt-BR')
  })
})

describe('negotiateLocale (PRODUCT spec §4 item 2)', () => {
  const base = { locales, baseLocale: 'en' }

  it('takes the hosted session locale first', () => {
    expect(negotiateLocale({ ...base, hosted: 'fr-CA', saved: 'pt-BR', browser: ['pt-BR'] })).toBe('fr')
  })

  it('falls through an unsupported hosted locale to the saved choice', () => {
    expect(negotiateLocale({ ...base, hosted: 'de', saved: 'pt-BR', browser: ['fr'] })).toBe('pt-BR')
  })

  it("then to the browser's first supported language", () => {
    expect(
      negotiateLocale({ ...base, hosted: undefined, saved: undefined, browser: ['de', 'fr-FR', 'en'] }),
    ).toBe('fr')
  })

  it("then to the game's default", () => {
    expect(negotiateLocale({ ...base, hosted: 'de', saved: undefined, browser: ['ja'] })).toBe('en')
  })

  it('ignores a saved choice that is no longer one of the locales', () => {
    expect(negotiateLocale({ ...base, hosted: undefined, saved: 'ko', browser: [] })).toBe('en')
  })
})
