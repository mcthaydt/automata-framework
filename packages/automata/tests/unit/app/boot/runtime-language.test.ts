import { describe, expect, it, vi } from 'vitest'
import { createRuntimeLanguage } from '#src/app/boot/runtime-language.ts'

// The runtime's own words (loading, failures, the lost picture, the rotate hint) are in one language, and that language
// is the player's: the browser's guess until the host and the saved choice are known, then the locale service's, which
// the first-run pick and Settings change. One source, so no panel keeps the words it was built with.

const def = { locales: ['en', 'ja', 'ko'], baseLocale: 'en' }

/** A stand-in for the locale service: `subscribe` calls at once, then on each change. */
function fakeLocale(initial: string) {
  const listeners = new Set<(locale: string) => void>()
  let current = initial
  return {
    get current() {
      return current
    },
    subscribe(listener: (locale: string) => void) {
      listeners.add(listener)
      listener(current)
      return () => void listeners.delete(listener)
    },
    set(next: string) {
      current = next
      for (const listener of listeners) listener(next)
    },
  }
}

describe('createRuntimeLanguage', () => {
  it('starts from the browser’s languages, as the locale service will', () => {
    expect(createRuntimeLanguage({ def, browser: ['ko-KR'] }).current).toBe('ko')
    expect(createRuntimeLanguage({ def, browser: ['fr'] }).current).toBe('en')
  })

  it('takes the host’s language over the browser’s once the host is known', () => {
    const language = createRuntimeLanguage({ def, browser: ['en'] })
    language.useHost('ja')
    expect(language.current).toBe('ja')
  })

  it('ignores a host language the game does not ship', () => {
    const language = createRuntimeLanguage({ def, browser: ['ko'] })
    language.useHost('fr')
    expect(language.current).toBe('ko')
  })

  it('follows the locale service once it exists, including the saved choice and every later change', () => {
    const language = createRuntimeLanguage({ def, browser: ['en'] })
    const locale = fakeLocale('ja')
    language.follow(locale)
    expect(language.current).toBe('ja')
    locale.set('ko')
    expect(language.current).toBe('ko')
  })

  it('tells a subscriber on each change and on none that changes nothing', () => {
    const language = createRuntimeLanguage({ def, browser: ['en'] })
    const heard = vi.fn()
    const stop = language.subscribe(heard)
    const locale = fakeLocale('en')
    language.follow(locale)
    expect(heard).not.toHaveBeenCalled()
    locale.set('ja')
    locale.set('ja')
    expect(heard).toHaveBeenCalledTimes(1)
    stop()
    locale.set('ko')
    expect(heard).toHaveBeenCalledTimes(1)
  })

  it('stops following when asked', () => {
    const language = createRuntimeLanguage({ def, browser: ['en'] })
    const locale = fakeLocale('ja')
    language.follow(locale)()
    locale.set('ko')
    expect(language.current).toBe('ja')
  })
})
