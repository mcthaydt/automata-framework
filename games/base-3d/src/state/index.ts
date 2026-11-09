// base-3d's state (the GL spec's `state.ts`): the plugin that lists every definition, and the starting world (the room
// compiled once, before the sim is made, and the entities the sim starts with). Sim code: `pnpm boundaries` checks it.
import { CameraHeading, enterView, START } from '@automataframework/automata-render-pixi3d/sim'
import { definePlugin, type PluginDef, type Sim } from '@automataframework/automata-sim'
import { Act, Move } from '../commands.ts'
import { Ember, Hero, HeroAction, HeroControl } from '../components.ts'
import { EmberTaken, GoalReached, HeroFell, HeroRolled } from '../events.ts'
import { Location, Progress } from '../resources.ts'
import { type Area, emberTake, heroInput, heroMove, heroView, viewAt } from '../systems/index.ts'

/**
 * Spawns Wick at the area's spawn, already in his room's view (the first view never latches) and facing away from the
 * camera, and an ember at each of the area's ember points and the goal ember at its goal.
 */
export function spawnArea(sim: Sim, area: Area): void {
  const view = viewAt(area, area.spawn.x, area.spawn.z)
  const heading = view === undefined ? START : enterView(START, view, { x: 0, y: 0 })
  sim.spawn([
    [Hero, { x: area.spawn.x, z: area.spawn.z, facing: heading.heading }],
    HeroControl,
    HeroAction,
    [CameraHeading, heading],
  ])
  // A fall before he crosses into another room returns him to the spawn, facing as he starts.
  const place = sim.resource(Location)
  place.returnX = area.spawn.x
  place.returnZ = area.spawn.z
  place.returnFacing = heading.heading
  for (const [index, ember] of area.embers.entries())
    sim.spawn([[Ember, { x: ember.x, z: ember.z, goal: false, index }]])
  sim.spawn([[Ember, { x: area.goal.x, z: area.goal.z, goal: true, index: area.embers.length }]])
}

/** The free game's sim. It depends on render-pixi3d's `camera-heading` plugin for the heading. */
export const base3dPlugin: PluginDef = definePlugin({
  name: 'base-3d',
  dependsOn: ['camera-heading'],
  resources: [Progress, Location],
  defs: [
    Hero,
    HeroControl,
    HeroAction,
    Ember,
    Move,
    Act,
    EmberTaken,
    GoalReached,
    HeroFell,
    HeroRolled,
    heroInput,
    heroMove,
    heroView,
    emberTake,
  ],
})

/** The sim spec `defineGame` takes: what `base3dSim` returns. */
export interface Base3dSim {
  readonly plugins: readonly PluginDef[]
  readonly seed: number
  readonly content: Area
  readonly setup: (sim: Sim) => void
}

/**
 * How the game makes its sim from its compiled area: `main.ts` and the golden replay both start from here (the sim takes
 * content as data, never as an import, GL spec §4.5). It names no `tickHz`, because `defineGame`'s sim spec has none: the
 * page's sim runs at the sim's default, 60 Hz, which is `TICK_HZ` (the page's test checks it).
 */
export function base3dSim(area: Area): Base3dSim {
  return {
    // The heading's plugin is render3dExtension's (`main.ts`): `defineGame` adds an extension's sim plugins (RT.EXT1).
    plugins: [base3dPlugin],
    seed: 1,
    content: area,
    setup: (sim) => spawnArea(sim, area),
  }
}
