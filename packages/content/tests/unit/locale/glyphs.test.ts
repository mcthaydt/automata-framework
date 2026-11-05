import { describe, expect, it } from 'vitest'
import { ALWAYS_CHARACTERS, catalogCharacters, localeCharacters } from '#src/features/locale/glyphs.ts'

describe('glyph sets per locale (PRODUCT spec §4 item 6)', () => {
  it('holds every character of every message, and never the $schema', () => {
    const characters = catalogCharacters({ $schema: 'https://inlang.com/z', a: 'Écarlate', b: 'Aube' })
    expect([...characters].sort()).toEqual(['A', 'a', 'b', 'c', 'e', 'l', 'r', 't', 'u', 'É'].sort())
  })

  it('counts a character outside the Basic Multilingual Plane once', () => {
    expect([...catalogCharacters({ a: '𠮷' })]).toEqual(['𠮷'])
  })

  it('adds what a subset always needs: printable ASCII, CJK punctuation, full-width forms, a few symbols', () => {
    expect(ALWAYS_CHARACTERS).toContain(' ')
    expect(ALWAYS_CHARACTERS).toContain('~')
    expect(ALWAYS_CHARACTERS).toContain('。')
    expect(ALWAYS_CHARACTERS).toContain('Ａ')
    for (const symbol of ['…', '—', '·', '←', '→', '✓', '×']) expect(ALWAYS_CHARACTERS).toContain(symbol)
    expect(ALWAYS_CHARACTERS).not.toContain('\n')
    const characters = localeCharacters({ a: 'Ω' })
    expect(characters.has('Ω')).toBe(true)
    expect(characters.size).toBe(new Set([...ALWAYS_CHARACTERS, 'Ω']).size)
  })
})
