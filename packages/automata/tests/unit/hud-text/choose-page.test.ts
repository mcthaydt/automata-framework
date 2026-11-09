import { describe, expect, it } from 'vitest'
import { choosePage, missingFrom, normalise } from '#src/features/hud-text/choose-page.ts'
import { HUD_PAGES } from '#src/features/hud-text/pages.ts'

describe('choosePage', () => {
  it.each([
    ['Bump!', 'latin'],
    ['Ça va ?', 'latin'],
    ['Zażółć gęślą jaźń', 'latin'],
    ['İyi şanslar', 'latin'],
    ['C’est l’heure', 'latin'],
    ['Привет, Ana!', 'cyrillic'],
    ['Ґанок №1', 'cyrillic'],
    ['м’яч', 'cyrillic'],
    ['пʼять', 'cyrillic'],
  ])('%s draws from %s', (text, page) => {
    expect(choosePage(text, HUD_PAGES)).toBe(page)
  })

  it.each([['Aïe, un mur ! 好'], ['Hi 👋'], ['Ελα']])('%s draws from no page', (text) => {
    // Geist has Greek, but no page bakes it.
    expect(choosePage(text, HUD_PAGES)).toBeUndefined()
  })

  it('treats an empty string and a line break as covered by the first page', () => {
    expect(choosePage('', HUD_PAGES)).toBe('latin')
    expect(choosePage('a\nb', HUD_PAGES)).toBe('latin')
  })

  it('does not mix faces: one string never takes letters from two pages', () => {
    expect(choosePage('Ça Привет', HUD_PAGES)).toBeUndefined()
  })

  it('chooses from the pages it is given, in order', () => {
    const only = [{ id: 'cyrillic', chars: 'ab' }] as const
    expect(choosePage('ab', only)).toBe('cyrillic')
    expect(choosePage('abc', only)).toBeUndefined()
  })
})

describe('normalise', () => {
  it('turns the narrow no-break space French typing puts before ! into a no-break space', () => {
    expect(normalise('Aïe, un mur !')).toBe('Aïe, un mur !')
    expect(choosePage(normalise('Aïe, un mur !'), HUD_PAGES)).toBe('latin')
  })

  it('turns the thin space into a no-break space', () => {
    expect(normalise('a b')).toBe('a b')
  })

  it('removes soft hyphens and control characters', () => {
    expect(normalise('Fuß­ball')).toBe('Fußball')
    expect(normalise('a\u0007b\nc')).toBe('abc')
  })
})

describe('missingFrom', () => {
  it('lists the code points no page holds, once each', () => {
    expect(missingFrom('Aïe 好好 👋', HUD_PAGES)).toEqual(['好', '👋'])
  })

  it('lists a letter another page would hold only when no page holds it', () => {
    expect(missingFrom('Привет Ça', HUD_PAGES)).toEqual([])
  })
})

// Ten labels at 60 frames a second ask for a page 600 times a second: each page's letters are read once.
describe('page choice cost', () => {
  it('reads a page’s characters once, however often a string is chosen or checked', () => {
    let reads = 0
    const page = {
      id: 'latin' as const,
      get chars() {
        reads++
        return 'abc'
      },
    }
    for (let i = 0; i < 50; i++) {
      choosePage('abc', [page])
      missingFrom('abz', [page])
    }
    expect(reads).toBe(1)
  })
})
