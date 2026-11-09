import type { ProjectStore } from '@automata/editor/kit'
import { type OpenedSuitePorts, openSuitePorts, pageIsServed } from '@automata/editor/suite'
import { type GameEntry, openWebGames, type WebGames } from '@automata/editor/web-games'
import { openContentSuite } from './open-content-suite.ts'
import { tapWrites } from './tapped-store.ts'

// What the page with every editor shows. A page served by `automata editor` shows its checkout, whatever the address
// says. Anywhere else it is the person's own games, kept in this browser: `?game=` names one, `?games` asks for the
// list, `?new=` for a new game of a kind, `?sample` for the sample, and with nothing said it opens the game left open
// last, or the list when there is none (or the one named is gone).

export type ContentPage =
  | { readonly kind: 'checkout' | 'sample'; readonly opened: OpenedSuitePorts }
  | {
      readonly kind: 'game'
      readonly opened: OpenedSuitePorts
      readonly game: GameEntry
      readonly games: WebGames
      /** The game's own files, apart from the ones the editors write through: what a sync writes here is not an edit. */
      readonly store: ProjectStore
      readonly editor?: string | undefined
    }
  | { readonly kind: 'games'; readonly games: WebGames }
  | { readonly kind: 'new'; readonly startingPoint: string; readonly games: WebGames }

export type ContentPageEnv = Parameters<typeof openContentSuite>[0] & {
  now(): number
  /** Told which files the person's editors changed in their own game (for the sync to commit). */
  onEdit?: ((paths: readonly string[]) => void) | undefined
}

export async function openContentPage(env: ContentPageEnv): Promise<ContentPage> {
  if (await pageIsServed(env)) return { kind: 'checkout', opened: await openContentSuite(env) }
  const query = new URLSearchParams(env.search)
  if (query.has('sample')) return { kind: 'sample', opened: await openContentSuite(env) }

  const games = await openWebGames(env)
  const startingPoint = query.get('new')
  if (startingPoint !== null) return { kind: 'new', startingPoint, games }
  if (query.has('games')) return { kind: 'games', games }

  const named = query.get('game')
  const last = await games.last()
  const id = named ?? last?.game
  const game = id === undefined ? undefined : (await games.list()).find((entry) => entry.id === id)
  if (game === undefined) return { kind: 'games', games }
  const store = await games.store(game.id)
  const opened = await openSuitePorts({
    ...env,
    local: {
      store: env.onEdit === undefined ? store : tapWrites(store, env.onEdit),
      title: game.title,
      where: games.kept ? 'device' : 'nowhere',
      reason: games.reason,
    },
  })
  return {
    kind: 'game',
    opened,
    game,
    games,
    store,
    ...(last?.game === game.id && last.editor !== undefined ? { editor: last.editor } : {}),
  }
}
