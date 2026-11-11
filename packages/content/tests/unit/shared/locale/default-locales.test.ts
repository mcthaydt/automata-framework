import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALES, ENDONYMS, endonymOf } from '#src/shared/locale/index.ts'

// The six languages every game on the framework ships, in the order the language picker lists them. The names are
// the framework's own, because the engines disagree about some (`Intl` says "Español (Latinoamérica)" for es-419).

describe('DEFAULT_LOCALES', () => {
  it('is the six languages, the source first, in picker order', () => {
    expect(DEFAULT_LOCALES).toEqual(['en', 'ja', 'ko', 'es-419', 'pt-BR', 'zh-Hans'])
  })

  it('has a name for each language, in that language', () => {
    expect(ENDONYMS).toEqual({
      en: 'English',
      ja: '日本語',
      ko: '한국어',
      'es-419': 'Español',
      'pt-BR': 'Português (Brasil)',
      'zh-Hans': '简体中文',
    })
  })
})

describe('endonymOf with the six', () => {
  it('answers from the framework names first', () => {
    expect(endonymOf('es-419')).toBe('Español')
  })

  it('still asks Intl for a tag outside the six', () => {
    expect(endonymOf('fr')).toBe('Français')
  })
})
