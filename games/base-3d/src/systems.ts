// base-3d's systems and their order (DESIGN.md §3.1). Sim code: `pnpm boundaries` checks every file in src/.
// A tick runs: the camera's turn (render-pixi3d, input), the stick and lock copied onto Wick (input), the lock
// target held or chosen (prePhysics), Wick moved through the heading (physics), the room's view entered
// (postPhysics).
import {
  CameraHeading,
  cameraHeadingPlugin,
  enterView,
  moveDirection,
  Q16,
  TURN_UNITS,
  wrapHeading,
} from '@mcthaydt/automata-render-pixi3d/sim'
import { definePlugin, defineSystem, type PluginDef, type Sim, type SystemDef } from '@mcthaydt/automata-sim'
import { atan2 } from '@mcthaydt/automata-sim/math'
import { Lock, Move } from './commands.ts'
import { Hero, HeroControl, Target } from './components.ts'
import { HERO_HALF, LOCK_RANGE, TICK_HZ, WALK_PER_TICK } from './constants.ts'
import { FIRST_SLICE } from './content/first-slice.content.ts'
import { type Area, areaOf, compileArea, slide, spawnArea, viewAt } from './state.ts'

// 2π spelled out: `Math.PI` is not sim-safe.
const TAU = 6.283185307179586
const HALF_TURN = TURN_UNITS / 2

/** The turn-unit angle of the plan direction `x`, `z` (0 toward +z, growing toward +x), rounded to a unit. */
const angleOf = (x: number, z: number): number => wrapHeading((atan2(x, z) * TURN_UNITS) / TAU)

/** `units` as the nearest signed angle, −32,768..32,767. */
const signedTurn = (units: number): number => wrapHeading(units + HALF_TURN) - HALF_TURN

/** Copies this tick's stick and lock onto Wick. No command is a centred stick and lock up. */
const heroInput: SystemDef = defineSystem({
  name: 'hero.input',
  phase: 'input',
  run(ctx) {
    const moves = ctx.commands.of(Move)
    const locks = ctx.commands.of(Lock)
    const stick = moves[moves.length - 1]?.payload ?? { x: 0, y: 0 }
    const lockHeld = locks[locks.length - 1]?.payload.down ?? false
    for (const entity of ctx.query(HeroControl))
      entity.set(HeroControl, { stickX: stick.x, stickY: stick.y, lockHeld })
  },
})

/**
 * Holds Wick's lock: while lock is held and he has no target, the nearest target within `LOCK_RANGE` in plan
 * (squared distances in Q16.16, exact below 2^53; a tie goes to the lower entity id); a release clears it. The
 * selection cone, cycling and the heading assist are GAME-3D.1b's (DESIGN.md §11).
 */
const lockSelect: SystemDef = defineSystem({
  name: 'lock.select',
  phase: 'prePhysics',
  run(ctx) {
    for (const entity of ctx.query(Hero, HeroControl)) {
      const hero = entity.get(Hero)
      if (!entity.get(HeroControl).lockHeld) {
        if (hero.lockTarget !== 0) entity.set(Hero, { lockTarget: 0 })
        continue
      }
      if (hero.lockTarget !== 0 && ctx.entity(hero.lockTarget)?.has(Target) === true) continue
      let best = 0
      let bestDistance = LOCK_RANGE * LOCK_RANGE
      // Ascending entity ids, and only a strictly nearer target replaces the best: a tie keeps the lower id.
      for (const target of ctx.query(Target)) {
        const { x, z } = target.get(Target)
        const distance = (x - hero.x) * (x - hero.x) + (z - hero.z) * (z - hero.z)
        if (distance < bestDistance || (best === 0 && distance === bestDistance)) {
          best = target.sid
          bestDistance = distance
        }
      }
      entity.set(Hero, { lockTarget: best })
    }
  },
})

/**
 * Moves Wick through the camera's heading (or the latched one, M3R-D15) at the walk speed scaled by the stick's
 * push. He faces the way he travels; standing, he keeps his facing; locked, he faces the target from where the tick
 * found him, and `moveDir` is his travel relative to that. Walls stop him (`slide`).
 */
const heroMove: SystemDef = defineSystem({
  name: 'hero.move',
  phase: 'physics',
  run(ctx) {
    const { walls } = areaOf(ctx.content)
    for (const entity of ctx.query(Hero, HeroControl, CameraHeading)) {
      const control = entity.get(HeroControl)
      const hero = entity.get(Hero)
      const mapped = moveDirection(entity.get(CameraHeading), { x: control.stickX, y: control.stickY })
      entity.set(CameraHeading, mapped.state)
      const { direction } = mapped
      const moving = direction.x !== 0 || direction.z !== 0
      // Exact: both factors are integers under 2^17, so the product is exact and the division by 2^16 too.
      const dx = Math.trunc((direction.x * WALK_PER_TICK) / Q16)
      const dz = Math.trunc((direction.z * WALK_PER_TICK) / Q16)
      const { x, z } = slide(walls, HERO_HALF, hero, dx, dz)
      const target = hero.lockTarget === 0 ? undefined : ctx.entity(hero.lockTarget)?.get(Target)
      const travel = angleOf(direction.x, direction.z)
      const facing =
        target !== undefined ? angleOf(target.x - hero.x, target.z - hero.z) : moving ? travel : hero.facing
      const moveDir = moving ? signedTurn(travel - facing) : 0
      entity.set(Hero, { x, z, facing, moving, moveDir })
    }
  },
})

/**
 * Puts Wick's camera in the view of the room he stands in. Entering another view takes its heading at once and,
 * with the stick held, latches the mapping to the old heading (`enterView`, M3R-D15); the next tick's move reads it.
 */
const heroView: SystemDef = defineSystem({
  name: 'hero.view',
  phase: 'postPhysics',
  run(ctx) {
    const area = areaOf(ctx.content)
    for (const entity of ctx.query(Hero, HeroControl, CameraHeading)) {
      const { x, z } = entity.get(Hero)
      const view = viewAt(area, x, z)
      const heading = entity.get(CameraHeading)
      if (view === undefined || view.id === heading.view) continue
      const control = entity.get(HeroControl)
      entity.set(CameraHeading, enterView(heading, view, { x: control.stickX, y: control.stickY }))
    }
  },
})

/** The first slice's sim (M3 spec §4.7). It depends on render-pixi3d's `camera-heading` plugin for the heading. */
export const base3dPlugin: PluginDef = definePlugin({
  name: 'base-3d',
  dependsOn: ['camera-heading'],
  defs: [Hero, HeroControl, Target, Move, Lock, heroInput, lockSelect, heroMove, heroView],
})

const firstSlice = compileArea(FIRST_SLICE)

/** How the game makes its sim: `main.ts` and the golden replay both start from here. */
export const BASE3D_SIM: {
  readonly plugins: readonly PluginDef[]
  readonly seed: number
  readonly tickHz: number
  readonly content: Area
  readonly setup: (sim: Sim) => void
} = {
  // The game lists render-pixi3d's `cameraHeadingPlugin` itself: the runtime does not install an extension's sim
  // plugins (`resolveExtensions` returns `simPlugins` and nothing uses them), so `render3dExtension.sim` would never
  // reach the sim and boot would fail with `unknown component "camera-heading"`. Routed to the runtime's owner.
  plugins: [cameraHeadingPlugin, base3dPlugin],
  seed: 1,
  tickHz: TICK_HZ,
  content: firstSlice,
  setup: (sim) => spawnArea(sim, firstSlice),
}
