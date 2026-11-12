import { describe, expect, it, vi } from 'vitest'
import { bindWords } from '#src/features/locale/bind-words.ts'

// A game with its own plain-DOM screens names a word on an element and has the runtime keep it in the language: filled
// now, and again whenever the player changes language.

/** A stand-in for the locale service: `subscribe` calls at once, then on each change. */
function fakeLocale(initial: string) {
  const listeners = new Set<(locale: string) => void>()
  return {
    subscribe(listener: (locale: string) => void) {
      listener(initial)
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    set(locale: string) {
      for (const listener of listeners) listener(locale)
    },
    listeners,
  }
}

const words = (locale: string) => ({
  play: locale === 'ja' ? 'あそぶ' : 'Play',
  pause: locale === 'ja' ? 'とめる' : 'Pause',
  time: (seconds: string) => `${seconds} s`,
})

function panel(): HTMLElement {
  const layer = document.createElement('div')
  layer.innerHTML =
    '<button data-word="play"></button><button data-word-label="pause" aria-label="old">II</button><p data-word="time"></p>'
  return layer
}

describe('bindWords', () => {
  it('fills the words at once: text for data-word, aria-label for data-word-label', () => {
    const layer = panel()
    bindWords(layer, fakeLocale('en'), words)
    expect(layer.querySelector('[data-word="play"]')?.textContent).toBe('Play')
    expect(layer.querySelector('[data-word-label]')?.getAttribute('aria-label')).toBe('Pause')
  })

  it('fills them again when the language changes, and keeps the elements', () => {
    const layer = panel()
    const locale = fakeLocale('en')
    const button = layer.querySelector('[data-word="play"]')
    bindWords(layer, locale, words)
    locale.set('ja')
    expect(layer.querySelector('[data-word="play"]')).toBe(button)
    expect(button?.textContent).toBe('あそぶ')
    expect(layer.querySelector('[data-word-label]')?.getAttribute('aria-label')).toBe('とめる')
  })

  it('leaves alone a word that is not text (a function) or not there', () => {
    const layer = panel()
    layer.insertAdjacentHTML('beforeend', '<i data-word="missing">kept</i>')
    bindWords(layer, fakeLocale('en'), words)
    expect(layer.querySelector('[data-word="time"]')?.textContent).toBe('')
    expect(layer.querySelector('[data-word="missing"]')?.textContent).toBe('kept')
  })

  it('tells the caller after each fill, with the words and the language, for what it works out itself', () => {
    const after = vi.fn()
    const locale = fakeLocale('en')
    bindWords(panel(), locale, words, after)
    locale.set('ja')
    expect(after).toHaveBeenCalledTimes(2)
    expect(after.mock.calls[1]?.[1]).toBe('ja')
    expect(after.mock.calls[1]?.[0].play).toBe('あそぶ')
  })

  it('returns what stops it', () => {
    const layer = panel()
    const locale = fakeLocale('en')
    bindWords(layer, locale, words)()
    locale.set('ja')
    expect(layer.querySelector('[data-word="play"]')?.textContent).toBe('Play')
    expect(locale.listeners.size).toBe(0)
  })
})
