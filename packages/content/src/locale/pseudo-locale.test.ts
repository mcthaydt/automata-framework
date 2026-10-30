// Extracted from Ruken packages/localization/src/pseudo.test.ts (d0fa2fe), at the PRODUCT spec's 40% and `xx-long`.
import { describe, expect, it } from 'vitest'
import * as locale from './index'
import { hasRawText, PSEUDO_LOCALE, pseudoLocalize, pseudoMessages } from './pseudo-locale'

describe('pseudoLocalize', () => {
  it('replaces every ASCII letter with an accented look-alike and marks the ends', () => {
    const out = pseudoLocalize('Open the settings')
    expect(out.startsWith('⟦')).toBe(true)
    expect(out.endsWith('⟧')).toBe(true)
    expect(out).not.toMatch(/[A-Za-z]/)
  })

  it('makes the text about 40% longer, so a layout that fits it has room for a longer language', () => {
    const original = 'Progress will sync when connected'
    const body = pseudoLocalize(original).slice(1, -1)
    expect(body.length).toBeGreaterThanOrEqual(Math.ceil(original.length * 1.4))
  })

  // Changed from Ruken, which puts all the extra length in one run at the end: a 1,000-character message then ended
  // in a 400-character word no language has, and ui's ErrorPanel scrolled it 1,482 px sideways (PRODUCT.L3a's first run).
  it('spreads the extra length over the words, so a long message keeps its places to break', () => {
    const original = 'Your progress in this slot will be gone for good. '.repeat(20).trim()
    const body = pseudoLocalize(original).slice(1, -1)
    const longest = (text: string): number => Math.max(...text.split(' ').map((word) => word.length))
    expect(body.split(' ')).toHaveLength(original.split(' ').length)
    expect(longest(body)).toBeLessThanOrEqual(Math.ceil(longest(original) * 1.4) + 1)
    expect(body.length).toBeGreaterThanOrEqual(Math.ceil(original.length * 1.4))
  })

  it('gives a message with no words its extra length at the end', () => {
    expect(pseudoLocalize('{count}')).toBe('⟦{count}···⟧')
  })

  it('keeps {placeholders} exactly as written', () => {
    const out = pseudoLocalize('Hello {name}, you have {count} games')
    expect(out).toContain('{name}')
    expect(out).toContain('{count}')
    expect(out.replace(/\{[a-z]+\}/g, '')).not.toMatch(/[A-Za-z]/)
  })

  it('keeps escaped braces and digits, which are not words', () => {
    const out = pseudoLocalize('Use \\{x\\} 3 times')
    expect(out).toContain('\\{')
    expect(out).toContain('\\}')
    expect(out).toContain('3')
  })

  it('gives the same answer every time', () => {
    expect(pseudoLocalize('Continue without loading')).toBe(pseudoLocalize('Continue without loading'))
  })

  it('leaves an empty message empty', () => {
    expect(pseudoLocalize('')).toBe('')
  })
})

describe('pseudoMessages', () => {
  it('converts nested namespaces and plural variants, and leaves variant selectors alone', () => {
    const out = pseudoMessages({
      $schema: 'https://inlang.com/schema/inlang-message-format',
      menu: { play: 'Play' },
      scores: [
        {
          declarations: ['input count', 'local countPlural = count: plural'],
          selectors: ['countPlural'],
          match: { 'countPlural=one': '{count} score', 'countPlural=other': '{count} scores' },
        },
      ],
    })
    expect(out.$schema).toBe('https://inlang.com/schema/inlang-message-format')
    expect((out.menu as Record<string, string>).play).toMatch(/^⟦/)
    const [variant] = out.scores as {
      declarations: string[]
      selectors: string[]
      match: Record<string, string>
    }[]
    expect(variant?.declarations).toEqual(['input count', 'local countPlural = count: plural'])
    expect(variant?.selectors).toEqual(['countPlural'])
    expect(Object.keys(variant?.match ?? {})).toEqual(['countPlural=one', 'countPlural=other'])
    expect(variant?.match['countPlural=one']).toContain('{count}')
    expect(variant?.match['countPlural=one']).toMatch(/^⟦/)
  })
})

describe('hasRawText', () => {
  it('is false for pseudo-localized text and for text with no letters in it', () => {
    expect(hasRawText(pseudoLocalize('Open the settings'))).toBe(false)
    expect(hasRawText('12')).toBe(false)
    expect(hasRawText('')).toBe(false)
  })

  it('is true for English that skipped the catalog', () => {
    expect(hasRawText('Open the settings')).toBe(true)
    // cspell:disable-next-line
    expect(hasRawText('⟦Óƥéñ⟧ and then some')).toBe(true)
  })
})

describe('PSEUDO_LOCALE', () => {
  it('is the spec’s xx-long, a tag Intl accepts, so formatting never throws in it', () => {
    expect(PSEUDO_LOCALE).toBe('xx-long')
    expect(new Intl.Locale(PSEUDO_LOCALE).language).toBe('xx')
    expect(() => new Intl.NumberFormat(PSEUDO_LOCALE).format(1234.5)).not.toThrow()
  })
})

// A game makes its xx-long catalog, and ui's layout contracts their words, from the browser-safe subpath.
describe('@mcthaydt/automata-content/locale', () => {
  it.each(['PSEUDO_LOCALE', 'pseudoLocalize', 'pseudoMessages', 'hasRawText'])('exports %s', (name) => {
    expect(locale).toHaveProperty(name)
  })
})
