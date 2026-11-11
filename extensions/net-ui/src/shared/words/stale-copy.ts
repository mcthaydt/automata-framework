// The stale-build panel's words as message catalogs, so `automata words` translates them as it does a game's. English is
// the source; a game that wants other words passes its own `copy` to the step. All six ship in the package: a language
// switch must be instant and offline.

import en from './en.json' with { type: 'json' }
import es419 from './es-419.json' with { type: 'json' }
import ja from './ja.json' with { type: 'json' }
import ko from './ko.json' with { type: 'json' }
import ptBR from './pt-BR.json' with { type: 'json' }
import zhHans from './zh-Hans.json' with { type: 'json' }

/** What the stale-build panel says. */
export interface StaleCopy {
  /** That the game was updated and what to do about it. */
  readonly message: string
  /** The one button: reloads the page. */
  readonly reload: string
}

const CATALOGS: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  en,
  ja,
  ko,
  'es-419': es419,
  'pt-BR': ptBR,
  'zh-Hans': zhHans,
}

const primary = (tag: string): string => tag.toLowerCase().split('-')[0] ?? tag

/**
 * The words for a locale: the same tag (ignoring case), else the first with the same primary language, so `pt` finds
 * `pt-BR` and `zh-CN` finds `zh-Hans`; English otherwise. The framework's own locale negotiation follows the same rule.
 */
export function staleWords(locale: string): StaleCopy {
  const tags = Object.keys(CATALOGS)
  const tag =
    tags.find((candidate) => candidate.toLowerCase() === locale.toLowerCase()) ??
    tags.find((candidate) => primary(candidate) === primary(locale)) ??
    'en'
  const catalog = CATALOGS[tag] ?? en
  return {
    message: catalog.stale_message ?? en.stale_message,
    reload: catalog.stale_reload ?? en.stale_reload,
  }
}
