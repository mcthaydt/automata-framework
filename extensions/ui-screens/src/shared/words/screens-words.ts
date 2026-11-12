// This package's words as message catalogs, so `automata words` translates them as it does a game's. English is the
// source; a game that wants other words passes its own `copy` to the screen's step. All six ship in the package: a
// language switch must be instant and offline.

import { matchLocale } from '@automata/framework'
import en from './en.json' with { type: 'json' }
import es419 from './es-419.json' with { type: 'json' }
import ja from './ja.json' with { type: 'json' }
import ko from './ko.json' with { type: 'json' }
import ptBR from './pt-BR.json' with { type: 'json' }
import zhHans from './zh-Hans.json' with { type: 'json' }

/** What the splash says. */
export interface SplashCopy {
  /** The line under the logo: any key or a tap goes on. */
  readonly skip: string
}

/** What the credits panel says. */
export interface CreditsCopy {
  readonly title: string
  /** The Close button's name. */
  readonly close: string
  /** What a screen reader says for a name that links to a page. */
  readonly opens: (name: string) => string
  /** Said under the list when a link could not be opened. */
  readonly refused: string
}

/** One catalog: message key to text. */
type Catalog = Readonly<Record<string, string>>

const CATALOGS: Readonly<Record<string, Catalog>> = {
  en,
  ja,
  ko,
  'es-419': es419,
  'pt-BR': ptBR,
  'zh-Hans': zhHans,
}

/** The catalog for a locale, by the framework's own matching rule (`pt` finds `pt-BR`); English where there is none. */
const catalogFor = (locale: string): Catalog =>
  CATALOGS[matchLocale(locale, Object.keys(CATALOGS)) ?? 'en'] ?? en

/** This package's words for a locale (the six; English otherwise): `{ splash, credits }`. */
export function screensWords(locale: string): { readonly splash: SplashCopy; readonly credits: CreditsCopy } {
  const catalog = catalogFor(locale)
  const word = (key: keyof typeof en): string => catalog[key] ?? en[key]
  return {
    splash: { skip: word('splash_skip') },
    credits: {
      title: word('credits_title'),
      close: word('credits_close'),
      opens: (name) => word('credits_opens').replaceAll('{name}', name),
      refused: word('credits_refused'),
    },
  }
}
