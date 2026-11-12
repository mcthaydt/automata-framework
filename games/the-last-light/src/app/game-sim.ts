import { cameraHeadingPlugin } from '@automata/3d/sim'
import { navExtension } from '@automata/nav'
import { sectorsExtension } from '@automata/sectors'
import { createSim, type Sim } from '@automata/sim'
import { spawnAda } from '../features/ada/ada.plugin.ts'
import { TICK_HZ } from '../shared/constants.ts'
import type { PlayContent } from '../shared/play-content.ts'
import { createRuntime } from './runtime.ts'
import { scenePlugin } from './scene.plugin.ts'

/**
 * A sim of the game on `play`, with no screen: what the unit tests and the bot step. Every plugin the page's game runs is
 * here, in the order `defineGame` gives them, so a test plays the game the page plays.
 */
export async function createGameSim(play: PlayContent, seed = 1): Promise<Sim> {
  const runtime = createRuntime(play)
  const sim = await createSim({
    seed,
    tickHz: TICK_HZ,
    plugins: [
      ...[sectorsExtension, navExtension, ...runtime.extensions].flatMap((extension) => extension.sim ?? []),
      cameraHeadingPlugin,
      ...runtime.plugins,
      scenePlugin(runtime),
    ],
    content: play,
  })
  spawnAda(sim, play.start, play.tuning.WALK_SPEED)
  return sim
}
