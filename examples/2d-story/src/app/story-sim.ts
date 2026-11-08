import { resolveExtensions } from '@automata/framework/extension'
import { createSim, type Sim } from '@automata/sim'
import { LEVEL } from '../features/level/level.ts'
import { itemOf } from '../features/level/level-items.ts'
import { Hero } from '../features/square/hero.component.ts'
import { Square } from '../features/square/square.component.ts'
import { squarePlugin } from '../features/square/square.plugin.ts'
import { EXTENSIONS, storyPlugin } from '../features/story/story.extensions.ts'
import { SQUARE_SIZE } from '../shared/constants.ts'

// The sim of the story, apart from the screen: the game's own plugins, the extensions' (`resolveExtensions` orders and checks
// them as `defineGame` does) and the player at the level's start. The game (game.ts) and its tests make theirs from this.

/** The game's own plugins, before the extensions'. */
export const PLUGINS = [squarePlugin, storyPlugin]

/** The plugins the sim runs: the game's own, then the extensions'. */
export const simPlugins = () => [...PLUGINS, ...resolveExtensions(EXTENSIONS).simPlugins]

/** The player stands on the level's start: the square's bottom edge there, so its centre half a square higher. */
export function setup(sim: Sim): void {
  const start = itemOf('player-start')
  sim.spawn([
    [Square, { x: start.x, y: start.y - SQUARE_SIZE / 2 }],
    [Hero, { frozen: false }],
  ])
}

/** A sim of the story at tick 0. */
export async function createStorySim(): Promise<Sim> {
  const sim = await createSim({ seed: 1, plugins: simPlugins(), content: LEVEL })
  setup(sim)
  return sim
}
