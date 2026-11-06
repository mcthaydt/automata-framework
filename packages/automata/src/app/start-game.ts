import type { RuntimeHandle, StartOptions } from './boot/game-definition.ts'
import { runGame } from './boot/run-game.ts'
import { type DefinedGame, defineGame, type GameSpec, isDefinedGame } from './define-game.ts'

/**
 * Boots a game: `defineGame`'s defaults over the runtime, the Pixi renderer, Ruken hosting
 * and the default screens, then the runtime's boot on the game's root. Takes a spec or a game `defineGame`
 * already returned. Throws `BootDefect` before anything mounts when the spec is invalid or there is no
 * root (`spec.root`, else `#game`); a failure after that shows on the runtime's boot failure panel. `start.at` starts on
 * another screen than the flow's entry, for a restart in development (`StartOptions`).
 */
export function startGame<S = never>(
  game: GameSpec<S> | DefinedGame<S>,
  start: StartOptions = {},
): RuntimeHandle {
  const defined = isDefinedGame(game) ? game : defineGame(game)
  // Read the root once, here, so a missing one throws before the runtime starts.
  return runGame({ ...defined, root: defined.root }, start)
}
