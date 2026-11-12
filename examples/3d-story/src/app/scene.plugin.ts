import { loadNavGraph } from '@automataframework/nav/sim'
import { loadPuzzle } from '@automataframework/puzzle/sim'
import { loadSectorMap } from '@automataframework/sectors/sim'
import { definePlugin, defineSystem, type PluginDef } from '@automataframework/sim'
import { type Systems, SystemsScene } from '@automataframework/systems/sim'
import { Actor } from '../features/guard/actor.component.ts'
import { syncActors } from '../features/guard/actor.system.ts'
import { storyIn } from './story.ts'

/**
 * The hall's start: on the first tick it gives the sim the level, the places, the puzzle and the characters, in the
 * order the extensions need them. The files are the game's content, so what Schematic saved is what loads.
 */
export function scenePlugin(systems: Systems): PluginDef {
  const load = defineSystem('scene.load', 'input', (ctx) => {
    // The systems' scene is empty until something loads one; it is the game's "not yet".
    if (ctx.resource(SystemsScene).def !== null) return
    const story = storyIn(ctx.content)
    loadSectorMap(ctx, story.map)
    loadNavGraph(ctx, story.graph)
    loadPuzzle(ctx, story.puzzle)
    systems.load(ctx, story.systems)
  })
  return definePlugin({
    name: 'scene',
    dependsOn: ['sectors', 'nav', 'puzzle', 'systems'],
    defs: [Actor, load, syncActors],
  })
}
