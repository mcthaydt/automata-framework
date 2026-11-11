import { createSim, type PluginDef, type Sim } from '@automata/sim'
import { TICK_HZ } from '../shared/constants.ts'
import { scenePlugin } from './scene.plugin.ts'

/** What the game plays in: its sim plugins, in order. The extensions' own are added by `defineGame`. */
export const GAME_PLUGINS: readonly PluginDef[] = [scenePlugin]

/**
 * A sim of the game on `content`, with no screen: what the unit tests and the bot step. The extensions' plugins are
 * given by the caller (a test names the ones it needs; `game.ts` lets `defineGame` add them).
 */
export function createGameSim(options: {
  readonly seed: number
  readonly content: unknown
  readonly plugins: readonly PluginDef[]
}): Promise<Sim> {
  return createSim({
    seed: options.seed,
    tickHz: TICK_HZ,
    plugins: [...options.plugins, ...GAME_PLUGINS],
    content: options.content,
  })
}
