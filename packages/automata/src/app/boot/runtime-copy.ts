// The runtime's own words (failures, loading, a lost picture) in a language: the bundled words with the game's own over
// them. Which language is `runtime-language.ts`'s: the browser's guess until the locale service exists, then its own.

import type { LocaleDef } from '../../features/locale/locale.manager.ts'
import { browserLanguages, singleLocale } from '../../features/locale/locale.manager.ts'
import { type RuntimeCopy, runtimeCopyFor } from '../screens/screens-catalog.ts'
import type { GameDefinition } from './game-definition.ts'

/** The runtime's words in `locale`: the bundled words with the game's own `copy` (a record, or a function of it) over them. */
export function runtimeCopyIn(copy: GameDefinition['copy'], locale: string): RuntimeCopy {
  return { ...runtimeCopyFor(locale), ...(typeof copy === 'function' ? copy(locale) : copy) }
}

/** The game's languages: its own, or the one language its content is written in. */
export const gameLocaleDef = (game: Pick<GameDefinition, 'locale' | 'content'>): LocaleDef =>
  game.locale ?? singleLocale(game.content.data.game?.source_language ?? 'en')

/** The browser's languages for a game: `win`'s, or the game's test seam. */
export const gameBrowserLanguages = (game: Pick<GameDefinition, 'seams'>, win: Window): readonly string[] =>
  game.seams?.languages ?? browserLanguages(win.navigator)
