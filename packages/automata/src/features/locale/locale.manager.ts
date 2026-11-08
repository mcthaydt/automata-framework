// The player's language, as a runtime service.
// The choice is its own save key, read and written through `Hosting.saves`, so a
// host that refuses the write keeps the change in memory only and nothing moves to device storage
// (AGENTS.md, Honor host authority). A change publishes `'locale.changed'`; no screen is remounted and the
// sim never hears of it, so a language switch keeps the screen, its focus and the sim hash (L-c).

import type { HostResult } from '../../shared/host/errors.ts'
import type { HostingSaves } from '../../shared/host/hosting.ts'
import type { PresentationBus } from '../../shared/runtime/presentation/presentation-bus.manager.js'
import { applyDocumentLocale, textDirection } from './document-locale.js'
import { negotiateLocale } from './negotiate-locale.js'
import { bindParaglide, type ParaglideRuntime } from './paraglide.js'

/** The save key of the player's language choice; absent means Automatic (negotiated). */
export const LOCALE_SAVE_KEY = 'automata.locale'

/**
 * The game's languages. A Paraglide-generated `runtime.js` satisfies it as is
 * (`import * as runtime from './paraglide/runtime.js'`), and then its messages answer in this locale.
 */
export interface LocaleDef {
  readonly locales: readonly string[]
  readonly baseLocale: string
  overwriteGetLocale?(fn: () => string): void
  overwriteSetLocale?(fn: (locale: string) => void): void
}

/**
 * The locale service: the game's locales, the one text is drawn in now, the player's choice
 * and the text direction.
 */
export interface Locale {
  /** The game's locales, in its own order (the picker's order). */
  readonly locales: readonly string[]
  readonly baseLocale: string
  /** The locale text is drawn in now. */
  readonly current: string
  /** The player's pick: one of `locales`, or null for Automatic (nothing saved, or a saved locale the game dropped). */
  readonly choice: string | null
  readonly direction: 'ltr' | 'rtl'
  /** Svelte store contract: called at once with the current locale, then on each change. */
  subscribe(listener: (locale: string) => void): () => void
  /**
   * The picker's one call: one of `locales`, or null for Automatic. Saved through `Hosting.saves`.
   * A locale the game does not ship throws: the picker only offers `locales`.
   */
  set(choice: string | null): void
}

/** The game's locales when it declares none: the one language its content is written in. */
export const singleLocale = (sourceLanguage: string): LocaleDef => ({
  locales: [sourceLanguage],
  baseLocale: sourceLanguage,
})

/** The browser's languages, best first; some WebViews report an empty list and only `language`. */
export function browserLanguages(
  navigator: Pick<Navigator, 'languages' | 'language'> | undefined,
): readonly string[] {
  if (navigator === undefined) return []
  if (navigator.languages !== undefined && navigator.languages.length > 0) return navigator.languages
  return navigator.language ? [navigator.language] : []
}

/** The three save calls the locale makes: read the choice at start, then write or clear it. */
export type LocaleSaves = Pick<HostingSaves, 'get' | 'set' | 'remove'>

export interface LocaleOptions {
  readonly def: LocaleDef
  readonly hosting: { readonly kind: string; readonly locale: string; readonly saves: LocaleSaves }
  /** The browser's languages, best first (`navigator.languages`). */
  readonly browser: readonly string[]
  readonly bus: Pick<PresentationBus, 'publish'>
  /** `<html>`; absent where there is no document. */
  readonly element: HTMLElement | undefined
  /** Where a refused save is reported. Default `console.warn`. */
  readonly warn?: (message: string) => void
}

/** Negotiates the locale (reading the saved choice first) and sets `<html lang dir>` before it resolves. */
export async function createLocale(options: LocaleOptions): Promise<Locale> {
  const { def, hosting, bus, element } = options
  const warn = options.warn ?? ((message: string) => console.warn(message))
  // Standalone, the SDK's session locale is navigator.language: the browser step already covers it.
  const hosted = hosting.kind === 'ruken' ? hosting.locale : undefined
  const negotiate = (saved: string | undefined) =>
    negotiateLocale({
      hosted,
      saved,
      browser: options.browser,
      locales: def.locales,
      baseLocale: def.baseLocale,
    })

  // A refused read is logged and negotiation goes on without the saved step; it never reads device storage.
  const read = await hosting.saves.get(LOCALE_SAVE_KEY)
  if (!read.ok) warn(`locale: saves.get for '${LOCALE_SAVE_KEY}' failed: ${read.reason.code}`)
  const saved = read.ok ? read.value : null

  let current = negotiate(saved ?? undefined)
  let chosen: string | null =
    saved !== null && saved !== undefined && def.locales.includes(saved) ? saved : null
  const listeners = new Set<(locale: string) => void>()
  if (element !== undefined) applyDocumentLocale(element, current)

  // The write runs in the background: the switch is already shown, and a refusal only keeps it in memory.
  const persist = (write: Promise<HostResult<void>>) =>
    void write.then((result) => {
      if (!result.ok) warn(`locale: saving '${LOCALE_SAVE_KEY}' failed: ${result.reason.code}`)
    })

  const locale: Locale = {
    locales: def.locales,
    baseLocale: def.baseLocale,
    get current() {
      return current
    },
    get choice() {
      return chosen
    },
    get direction() {
      return textDirection(current)
    },
    subscribe(listener) {
      listeners.add(listener)
      listener(current)
      return () => {
        listeners.delete(listener)
      }
    },
    set(choice) {
      if (choice !== null && !def.locales.includes(choice)) {
        throw new Error(
          `Locale.set: '${choice}' is not one of the game's locales (${def.locales.join(', ')})`,
        )
      }
      chosen = choice
      // Memory first, then the host: the same order as Settings.update.
      persist(
        choice === null ? hosting.saves.remove(LOCALE_SAVE_KEY) : hosting.saves.set(LOCALE_SAVE_KEY, choice),
      )
      const next = choice ?? negotiate(undefined)
      if (next === current) return
      const previous = current
      current = next
      if (element !== undefined) applyDocumentLocale(element, current)
      for (const listener of [...listeners]) listener(current)
      bus.publish('locale.changed', { locale: current, previous })
    },
  }

  // A Paraglide runtime: its messages now read `current`, and its setLocale goes through `set`.
  if (def.overwriteGetLocale !== undefined && def.overwriteSetLocale !== undefined) {
    bindParaglide(def as ParaglideRuntime, { current: () => current, set: (choice) => locale.set(choice) })
  }
  return locale
}
