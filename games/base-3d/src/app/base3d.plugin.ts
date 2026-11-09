// base-3d's state plugin: the list of every definition, and the entities the sim starts with (`spawnArea`). Sim code: `pnpm boundaries` checks it.
import { CameraHeading, enterView, START } from '@automata/3d/sim'
import { definePlugin, type PluginDef, type Sim } from '@automata/sim'
import { emberTake } from '../features/embers/ember.system.ts'
import { heroInput, heroMove, heroView } from '../features/hero/hero.system.ts'
import { Act, Move } from '../features/hero/move.command.ts'
import { type Area, viewAt } from '../shared/area.ts'
import { Ember } from '../shared/ember.component.ts'
import { EmberTaken, GoalReached } from '../shared/ember.event.ts'
import { Hero, HeroAction, HeroControl } from '../shared/hero.component.ts'
import { HeroFell, HeroRolled } from '../shared/hero.event.ts'
import { Location } from '../shared/location.resource.ts'
import { Progress } from '../shared/progress.resource.ts'

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

/** The free game's sim. It depends on @automata/3d's `camera-heading` plugin for the heading. */
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
