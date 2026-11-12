import { describe, expect, it } from 'vitest'
import { matchLocale, negotiateLocale } from '#src/features/locale/negotiate-locale.ts'

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

  it("takes the player's saved choice first, over the hosted session locale", () => {
    expect(negotiateLocale({ ...base, hosted: 'fr-CA', saved: 'pt-BR', browser: ['fr'] })).toBe('pt-BR')
  })

  it('then the hosted session locale, when the player has not chosen', () => {
    expect(negotiateLocale({ ...base, hosted: 'fr-CA', saved: undefined, browser: ['pt-BR'] })).toBe('fr')
  })

  it('falls through an unsupported saved choice to the hosted session locale', () => {
    expect(negotiateLocale({ ...base, hosted: 'fr', saved: 'ko', browser: ['pt-BR'] })).toBe('fr')
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

describe('negotiateLocale across the six default languages', () => {
  const six = ['en', 'ja', 'ko', 'es-419', 'pt-BR', 'zh-Hans']
  const pick = (browser: string[]) =>
    negotiateLocale({ hosted: undefined, saved: undefined, browser, locales: six, baseLocale: 'en' })

  it('sends every Chinese tag to the one Chinese the game has', () => {
    expect(pick(['zh-TW'])).toBe('zh-Hans')
    expect(pick(['zh-Hant-HK'])).toBe('zh-Hans')
  })

  it('sends Portuguese and Spanish to the regional file the game ships', () => {
    expect(pick(['pt-PT'])).toBe('pt-BR')
    expect(pick(['es-ES'])).toBe('es-419')
  })

  it("takes the browser's order, the first language the game has", () => {
    expect(pick(['fr-FR', 'ko-KR'])).toBe('ko')
  })

  it('falls back to the source language', () => {
    expect(pick(['fr'])).toBe('en')
  })
})
