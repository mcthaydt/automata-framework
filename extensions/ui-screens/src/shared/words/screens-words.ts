// This package's words as message catalogs, so `automata words` translates them as it does a game's. English is the
// source; a game that wants other words passes its own `copy` to the screen's step. All six ship in the package: a
// language switch must be instant and offline.

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

const primary = (tag: string): string => (tag.toLowerCase().split('-')[0] ?? tag).toLowerCase()

/**
 * The catalog for a locale: the same tag (ignoring case), else the first with the same primary language, so `pt` finds
 * `pt-BR` and `zh-CN` finds `zh-Hans`; English otherwise. The framework's own locale negotiation follows the same rule.
 */
function catalogFor(locale: string): Catalog {
  const tags = Object.keys(CATALOGS)
  const tag =
    tags.find((candidate) => candidate.toLowerCase() === locale.toLowerCase()) ??
    tags.find((candidate) => primary(candidate) === primary(locale)) ??
    'en'
  return CATALOGS[tag] ?? en
}

/** This package's words for a locale (the six; English otherwise). */
export function screensWords(locale: string): { readonly splash: SplashCopy } {
  const catalog = catalogFor(locale)
  return { splash: { skip: catalog.splash_skip ?? en.splash_skip } }
}
