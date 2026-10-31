// base-3d's state (DESIGN.md §3.1, the GL spec's `state.ts`): the plugin that lists every definition, and the
// starting world (the first slice compiled once, before the sim is made, and the entities the sim starts with).
// Sim code: `pnpm boundaries` checks it.
import { CameraHeading, enterView, START } from '@mcthaydt/automata-render-pixi3d/sim'
import { definePlugin, type PluginDef, type Sim } from '@mcthaydt/automata-sim'
import { Act, Lock, LockCycle, Move } from '../commands.ts'
import {
  Bomb,
  Chain,
  Drop,
  Enemy,
  Fighter,
  Hero,
  HeroAction,
  HeroControl,
  Pellet,
  Target,
} from '../components.ts'
import { CONTINUE_HEALTH, CombatState, HERO_HALF, HERO_HEALTH, HERO_HEIGHT } from '../constants/index.ts'
import {
  AreaEntered,
  AreaExit,
  BombBlast,
  BossDefeated,
  BossPhase,
  CaptainDefeated,
  ChainHooked,
  DropTaken,
  EmberTaken,
  FoeDefeated,
  HeroDefeated,
  HitLanded,
  ShotFired,
} from '../events.ts'
import { Freeze, Inventory, Location, Progress } from '../resources.ts'
import {
  type Area,
  areaExit,
  bombFuse,
  chainFly,
  combatFreeze,
  combatHits,
  combatMoves,
  combatStatus,
  dropsTake,
  emberTake,
  enemyBrain,
  heroAct,
  heroInput,
  heroMove,
  heroView,
  itemUse,
  lockAssist,
  lockSelect,
  pelletFly,
  spawnFoes,
  viewAt,
  type World,
} from '../systems/index.ts'

/**
 * Spawns Wick at the area's spawn, already in its room's view (the first view never latches) and facing away from
 * the camera, with his 4 hearts, and a training dummy at each of the area's target points (DESIGN.md §7).
 */
export function spawnArea(sim: Sim, area: Area): void {
  const view = viewAt(area, area.spawn.x, area.spawn.z)
  const heading = view === undefined ? START : enterView(START, view, { x: 0, y: 0 })
  sim.spawn([
    [Hero, { x: area.spawn.x, z: area.spawn.z, facing: heading.heading }],
    HeroControl,
    HeroAction,
    [CameraHeading, heading],
    [Fighter, { side: 0, health: HERO_HEALTH, radius: HERO_HALF, height: HERO_HEIGHT }],
  ])
  // A fall before he crosses into another room returns him to the spawn, facing as he starts (DESIGN.md §7.8).
  const place = sim.resource(Location)
  place.returnX = area.spawn.x
  place.returnZ = area.spawn.z
  place.returnFacing = heading.heading
  for (const parts of spawnFoes(area)) sim.spawn(parts)
}

/**
 * The game over's Continue (DESIGN.md §7.8): after the screens restore the area entrance's snapshot, Wick goes on
 * with 3 hearts, standing, whatever the entrance held. Outside a step, as the save's `apply` is (§12.1).
 */
export function continueWith3Hearts(sim: Sim): void {
  for (const { sid } of sim.query(Hero, Fighter))
    sim.entity(sid)?.set(Fighter, {
      health: CONTINUE_HEALTH,
      state: CombatState.idle,
      stun: 0,
      move: 0,
      moveTick: 0,
      queued: 0,
      pushTicks: 0,
      charge: 0,
    })
}

/** The first slice's sim (M3 spec §4.7). It depends on render-pixi3d's `camera-heading` plugin for the heading. */
export const base3dPlugin: PluginDef = definePlugin({
  name: 'base-3d',
  dependsOn: ['camera-heading'],
  resources: [Progress, Location, Freeze, Inventory],
  defs: [
    Hero,
    HeroControl,
    HeroAction,
    Target,
    Fighter,
    Enemy,
    Drop,
    Pellet,
    Bomb,
    Chain,
    Move,
    Lock,
    LockCycle,
    Act,
    EmberTaken,
    HeroDefeated,
    HitLanded,
    FoeDefeated,
    DropTaken,
    CaptainDefeated,
    BossPhase,
    BossDefeated,
    ShotFired,
    BombBlast,
    ChainHooked,
    AreaExit,
    AreaEntered,
    heroInput,
    combatFreeze,
    lockSelect,
    lockAssist,
    heroAct,
    itemUse,
    combatStatus,
    enemyBrain,
    combatMoves,
    emberTake,
    heroMove,
    chainFly,
    dropsTake,
    areaExit,
    heroView,
    pelletFly,
    bombFuse,
    combatHits,
  ],
})

/** The sim spec `defineGame` takes: what `base3dSim` returns. */
export interface Base3dSim {
  readonly plugins: readonly PluginDef[]
  readonly seed: number
  readonly content: World
  readonly setup: (sim: Sim) => void
}

/**
 * How the game makes its sim from a compiled world: `main.ts` and the golden replay both start from here, with the
 * first slice (`compileWorld([FIRST_SLICE])`; the sim takes content as data, never as an import, GL spec §4.5), and
 * a new game starts in its first area. It
 * names no `tickHz`, because `defineGame`'s sim spec has none: the page's sim runs at the sim's default, 60 Hz,
 * which is `TICK_HZ` (the page's test checks it), so the replay steps at the rate the game plays at.
 */
export function base3dSim(world: World): Base3dSim {
  const [first] = world.areas
  if (first === undefined) throw new Error('base-3d: the world has no areas')
  return {
    // The heading's plugin is render3dExtension's (`main.ts`): `defineGame` adds an extension's sim plugins (RT.EXT1).
    plugins: [base3dPlugin],
    seed: 1,
    content: world,
    setup: (sim) => spawnArea(sim, first),
  }
}
