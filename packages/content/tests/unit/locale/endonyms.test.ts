import { describe, expect, it } from 'vitest'
import { endonymOf } from './endonyms'
import * as locale from './index'

// A language's name in its own language, as the language picker shows it (ui's `LanguageSection`) and as the font
// build cuts it into every subset (M5 spec §4.7). Moved from ui's `language-section.ts` (M5.5F), test included.

describe('endonymOf', () => {
  it('names a language in its own language, falling back to its tag', () => {
    expect(endonymOf('ja')).toBe('日本語')
    expect(endonymOf('en')).toBe('English')
    expect(endonymOf('zz-Unknown-x1')).toBe('zz-Unknown-x1')
  })

  it('starts a name the engine writes in lower case with a capital, as a picker shows it', () => {
    expect(endonymOf('fr')).toBe('Français')
  })

  it('is exported by @mcthaydt/automata-content/locale', () => {
    expect(locale.endonymOf).toBe(endonymOf)
  })
})
