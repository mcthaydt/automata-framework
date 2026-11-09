import type { ProjectStore } from '@automata/editor/kit'
import { startWebSync, type WebGitHubSession, type WebSync } from '@automata/editor/kit/web-sync'
import type { GameEntry } from '@automata/editor/web-games'

// A web game linked to a GitHub repository keeps itself there; one that is not linked, or a page whose site has no
// sign-in, never reaches for GitHub. The page's timers and visibility are handed in.

type Timers = Parameters<typeof startWebSync>[0]['timers']
type Visibility = Parameters<typeof startWebSync>[0]['visibility']

export interface GameSyncEnv {
  readonly game: GameEntry
  /** The game's own files, not the ones the editors write through (a pull is not an edit). */
  readonly store: ProjectStore
  readonly session: WebGitHubSession | undefined
  readonly fetch: typeof fetch
  readonly timers: Timers
  readonly visibility: Visibility
  now(): number
}

export function keepOnGitHub(env: GameSyncEnv): WebSync | undefined {
  const { game, session } = env
  if (game.github === undefined || session === undefined) return undefined
  return startWebSync({
    fetch: env.fetch,
    session,
    store: env.store,
    repo: game.github,
    timers: env.timers,
    visibility: env.visibility,
    now: env.now,
    onError: (error) => console.error('Keeping the game on GitHub failed:', error),
  })
}
