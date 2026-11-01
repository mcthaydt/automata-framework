// base-3d's own words (after DX.2d): one record in the player's language, read by the HUD and the end screen, kept live as the locale changes.
import { describe, expect, it } from 'vitest'
import { followLocale, liveCopy } from './copy.svelte.ts'
import { BASE3D_COPY, base3dCopy } from './copy.ts'

describe('base3dCopy', () => {
  it('names the HUD’s, the end screen’s and the roll button’s words in English', () => {
    const copy = base3dCopy('en')
    expect(copy.hud.embers(2, 6)).toBe('Embers 2 of 6')
    expect(copy.end.title).toBe('The ember is yours')
    expect(copy.keys.roll).toBe('Roll')
  })

  it('falls back to English for a language the game has no words in yet', () => {
    expect(base3dCopy('fr')).toBe(BASE3D_COPY.en)
    expect(base3dCopy('fr', { ...BASE3D_COPY, fr: BASE3D_COPY.en })).toBe(BASE3D_COPY.en)
    expect(base3dCopy('en-GB')).toBe(BASE3D_COPY.en)
  })
})

describe('followLocale', () => {
  it('keeps the live words in the current locale until it stops', () => {
    let listener: ((locale: string) => void) | undefined
    const locale = {
      current: 'en',
      subscribe(next: (locale: string) => void) {
        listener = next
        next('en')
        return () => {
          listener = undefined
        }
      },
    }
    const french = { ...BASE3D_COPY.en, title: 'Salle des braises' }
    const stop = followLocale(locale, { ...BASE3D_COPY, fr: french })
    expect(liveCopy.current).toBe(BASE3D_COPY.en)
    listener?.('fr-CA')
    expect(liveCopy.current).toBe(french)
    stop()
    expect(listener).toBeUndefined()
    liveCopy.current = BASE3D_COPY.en
  })
})
