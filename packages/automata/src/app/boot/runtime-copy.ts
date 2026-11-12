// The runtime's own words (failures, loading, a lost picture) for the moments before the locale service exists: a
// failure can come before it, so the language is chosen from the browser's the way the service will choose it.

import type { LocaleDef } from '../../features/locale/locale.manager.ts'
import { browserLanguages, singleLocale } from '../../features/locale/locale.manager.ts'
import { negotiateLocale } from '../../features/locale/negotiate-locale.ts'
import { type RuntimeCopy, runtimeCopyFor } from '../screens/screens-catalog.ts'
import type { GameDefinition } from './game-definition.ts'

export interface EarlyRuntimeCopyOptions {
  /** The game's languages. */
  readonly def: Pick<LocaleDef, 'locales' | 'baseLocale'>
  /** The browser's languages, best first. */
  readonly browser: readonly string[]
  /** The game's own words, which win over the bundled ones. */
  readonly copy: GameDefinition['copy']
}

/**
 * The runtime's words in the language the player will most likely be given: the bundled words for the locale the
 * browser's languages negotiate, with the game's own `copy` laid over them. Nothing saved is read, so a player who
 * chose another language in Settings may see this once, until the locale service is up.
 */
export function runtimeCopyBeforeLocale(options: EarlyRuntimeCopyOptions): RuntimeCopy {
  const locale = negotiateLocale({
    hosted: undefined,
    saved: undefined,
    browser: options.browser,
    locales: options.def.locales,
    baseLocale: options.def.baseLocale,
  })
  return { ...runtimeCopyFor(locale), ...options.copy }
}

/** The game's languages: its own, or the one language its content is written in. */
export const gameLocaleDef = (game: Pick<GameDefinition, 'locale' | 'content'>): LocaleDef =>
  game.locale ?? singleLocale(game.content.data.game?.source_language ?? 'en')

/** `runtimeCopyBeforeLocale` for a game, with the browser's languages read from `win` (or the game's test seam). */
export const runtimeCopyForGame = (
  game: Pick<GameDefinition, 'locale' | 'content' | 'copy' | 'seams'>,
  win: Window,
): RuntimeCopy =>
  runtimeCopyBeforeLocale({
    def: gameLocaleDef(game),
    browser: game.seams?.languages ?? browserLanguages(win.navigator),
    copy: game.copy,
  })
