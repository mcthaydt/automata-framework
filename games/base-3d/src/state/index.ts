// base-3d's state (DESIGN.md §3.1, the GL spec's `state.ts`): the plugin that lists every definition, and the
// starting world (the first slice compiled once, before the sim is made, and the entities the sim starts with).
// Sim code: `pnpm boundaries` checks it.
import { CameraHeading, enterView, START } from '@mcthaydt/automata-render-pixi3d/sim'
import { definePlugin, type PluginDef, type Sim } from '@mcthaydt/automata-sim'
import { Act, Lock, Move } from '../commands.ts'
import { Hero, HeroAction, HeroControl, Target } from '../components.ts'
import { EmberTaken } from '../events.ts'
import {
  type Area,
  emberTake,
  heroAct,
  heroInput,
  heroMove,
  heroView,
  lockSelect,
  viewAt,
} from '../systems/index.ts'

/**
 * Spawns Wick at the area's spawn, already in its room's view (the first view never latches) and facing away from
 * the camera, and a target at each of the area's target points.
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
  for (const { x, z } of area.targets) sim.spawn([[Target, { x, z }]])
}

/** The first slice's sim (M3 spec §4.7). It depends on render-pixi3d's `camera-heading` plugin for the heading. */
export const base3dPlugin: PluginDef = definePlugin({
  name: 'base-3d',
  dependsOn: ['camera-heading'],
  defs: [
    Hero,
    HeroControl,
    HeroAction,
    Target,
    Move,
    Lock,
    Act,
    EmberTaken,
    heroInput,
    lockSelect,
    heroAct,
    emberTake,
    heroMove,
    heroView,
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
 * How the game makes its sim from a compiled area: `main.ts` and the golden replay both start from here, with the
 * first slice (`compileArea(FIRST_SLICE)`; the sim takes content as data, never as an import, GL spec §4.5). It
 * names no `tickHz`, because `defineGame`'s sim spec has none: the page's sim runs at the sim's default, 60 Hz,
 * which is `TICK_HZ` (the page's test checks it), so the replay steps at the rate the game plays at.
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
