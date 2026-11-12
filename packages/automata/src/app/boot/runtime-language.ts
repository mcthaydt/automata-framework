// The one source of the language the runtime's own words are in (loading, failures, the lost picture, the rotate hint).
// They are drawn before the locale service exists and long after it does, and every panel used to choose its words at
// its own moment, so some kept the browser's guess for the whole session. This holds the language instead, and the
// panels read it when they show (or hear it change): the browser's guess to begin with, the host's once the host is
// open, then the locale service's, which is the saved choice, the first-run pick and Settings.

import type { Locale, LocaleDef } from '../../features/locale/locale.manager.ts'
import { negotiateLocale } from '../../features/locale/negotiate-locale.ts'
import type { LiveWords } from '../../shared/runtime/live-words.ts'

/** The language the runtime's words are in now, and a way to hear it change. */
export interface RuntimeLanguage {
  readonly current: string
  /** Calls `listener` with each new language, not at once. Returns what stops it. */
  subscribe(listener: (locale: string) => void): () => void
}

/** What boot does to the language as it learns more: the host's, and then the locale service itself. */
export interface RuntimeLanguageControl extends RuntimeLanguage {
  /** The language a Ruken host supplies, once the host is open. A language the game does not ship changes nothing. */
  useHost(hosted: string | undefined): void
  /** Follows the locale service from now on, and sets the language to its own at once. Returns what stops it. */
  follow(locale: Pick<Locale, 'subscribe'>): () => void
}

export interface RuntimeLanguageOptions {
  readonly def: Pick<LocaleDef, 'locales' | 'baseLocale'>
  /** The browser's languages, best first. */
  readonly browser: readonly string[]
}

/** Starts from the browser's languages, the way the locale service will choose them with nothing saved. */
export function createRuntimeLanguage(options: RuntimeLanguageOptions): RuntimeLanguageControl {
  const { def, browser } = options
  const negotiate = (hosted: string | undefined): string =>
    negotiateLocale({ hosted, saved: undefined, browser, locales: def.locales, baseLocale: def.baseLocale })
  let current = negotiate(undefined)
  const listeners = new Set<(locale: string) => void>()
  const set = (next: string): void => {
    if (next === current) return
    current = next
    for (const listener of [...listeners]) listener(next)
  }
  return {
    get current() {
      return current
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => void listeners.delete(listener)
    },
    useHost: (hosted) => set(negotiate(hosted)),
    follow: (locale) => locale.subscribe(set),
  }
}

/** Words for the language in force, built when read and read again when it changes. */
export function wordsIn<T>(language: RuntimeLanguage, build: (locale: string) => T): LiveWords<T> {
  return {
    get current() {
      return build(language.current)
    },
    subscribe: (listener) => language.subscribe(() => listener()),
  }
}
