import { loadNavGraph, NavDoors } from '@automata/nav/sim'
import { loadPuzzle, PuzzleState } from '@automata/puzzle/sim'
import { loadSectorMap } from '@automata/sectors/sim'
import { definePlugin, defineSystem, type PluginDef, sortedEntries } from '@automata/sim'
import { SystemsScene } from '@automata/systems/sim'
import { DOOR_FACTS } from '../shared/doors.ts'
import { playIn } from '../shared/play-content.ts'
import type { Runtime } from './runtime.ts'

/** The cutscene the night begins on. */
const OPENING = 'opening'

/**
 * The game's start: on the first tick it gives the sim the level, the places, the puzzle, the creature, the story and the
 * hotspots, in the order the extensions need them. The files are the game's content, so what an editor saved is what loads.
 */
export function scenePlugin(runtime: Runtime): PluginDef {
  const load = defineSystem('scene.load', 'input', (ctx) => {
    // The systems' scene is empty until something loads one; it is the game's "not yet".
    if (ctx.resource(SystemsScene).def !== null) return
    const play = playIn(ctx.content)
    loadSectorMap(ctx, play.map)
    loadNavGraph(ctx, play.graph)
    loadPuzzle(ctx, play.puzzle, 'start')
    runtime.systems.load(ctx, play.systems)
    runtime.narrative.load(ctx, { canon: play.canon, graphs: [], storylets: [...play.storylets] })
    runtime.cutscenes.load(ctx, play.scripts)
    runtime.interact.load(ctx, play.hotspots)
    // The night opens on its cutscene, as the old game's begin did; the cutscene holds the input until it ends or is skipped.
    if (play.scripts.some((script) => script.id === OPENING)) runtime.cutscenes.start(ctx, OPENING)
  })
  // A door the walk keeps is open when the puzzle fact that opens it is true; it counts a change, so a route made before is
  // made again.
  const doors = defineSystem({
    name: 'scene.doors',
    phase: 'gameplay',
    before: ['nav.walk'],
    run: (ctx) => {
      const state = ctx.resource(PuzzleState)
      const nav = ctx.resource(NavDoors)
      for (const [door, fact] of sortedEntries(DOOR_FACTS)) {
        const open = state.facts[fact] === true
        if (nav.open[door] === open) continue
        nav.open[door] = open
        nav.version += 1
      }
    },
  })
  return definePlugin({
    name: 'scene',
    dependsOn: ['sectors', 'nav', 'puzzle', 'systems', 'narrative', 'cutscenes', 'interact'],
    defs: [load, doors],
  })
}
