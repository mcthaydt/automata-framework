// Wick's systems: the stick, lock and buttons copied onto him, his move through the heading, the room's view entered
// and his actions.
import { CameraHeading, enterView, mapStick, moveDirection, Q16 } from '@mcthaydt/automata-render-pixi3d/sim'
import { defineSystem, type SystemDef } from '@mcthaydt/automata-sim'
import { Act, Lock, LockCycle, Move } from '../commands.ts'
import { Hero, HeroAction, HeroControl, Target } from '../components.ts'
import {
  ACTION_BITS,
  ACTION_CLIP,
  ACTION_TICKS,
  EMBER_REACH,
  HERO_HALF,
  LOCK_RANGE,
  WALK_PER_TICK,
} from '../constants.ts'
import { Location } from '../resources.ts'
import { areaIn, slide, viewAt } from './area.ts'
import { angleOf, signedTurn } from './lock-target.ts'

/**
 * Copies this tick's stick, lock and action buttons onto Wick, and marks the tick each went down. No command is a
 * centred stick and every button up.
 */
export const heroInput: SystemDef = defineSystem({
  name: 'hero.input',
  phase: 'input',
  run(ctx) {
    const moves = ctx.commands.of(Move)
    const locks = ctx.commands.of(Lock)
    const stick = moves[moves.length - 1]?.payload ?? { x: 0, y: 0 }
    const lock = locks[locks.length - 1]?.payload
    const lockHeld = lock?.down ?? false
    const lockCycle = ctx.commands.of(LockCycle)[0]?.payload.dir ?? 0
    const acts = ctx.commands.of(Act)
    const act = acts[acts.length - 1]?.payload
    let actHeld = 0
    if (act?.slash === true) actHeld |= ACTION_BITS.slash
    if (act?.guard === true) actHeld |= ACTION_BITS.guard
    if (act?.point === true) actHeld |= ACTION_BITS.point
    if (act?.pickup === true) actHeld |= ACTION_BITS.pickup
    for (const entity of ctx.query(HeroControl)) {
      const before = entity.get(HeroControl)
      const lockPressed = lockHeld && !before.lockHeld
      const actPressed = actHeld & ~before.actHeld
      entity.set(HeroControl, {
        stickX: stick.x,
        stickY: stick.y,
        lockHeld,
        lockPressed,
        // No command keeps the mode the player last sent.
        lockHold: lock === undefined ? before.lockHold : lock.mode === 'hold',
        lockCycle,
        actHeld,
        actPressed,
      })
    }
  },
})

/**
 * Moves Wick through the camera's heading (or the latched one, M3R-D15) at the walk speed scaled by the stick's
 * push. He faces the way he travels; standing, he keeps his facing; locked, he faces the target from where the tick
 * found him, and `moveDir` is his travel relative to that. Walls stop him (`slide`).
 */
export const heroMove: SystemDef = defineSystem({
  name: 'hero.move',
  phase: 'physics',
  run(ctx) {
    const { walls } = areaIn(ctx.content, ctx.resource(Location))
    for (const entity of ctx.query(Hero, HeroControl, CameraHeading)) {
      const control = entity.get(HeroControl)
      const hero = entity.get(Hero)
      const stick = { x: control.stickX, y: control.stickY }
      const mapped = moveDirection(entity.get(CameraHeading), stick)
      entity.set(CameraHeading, mapped.state)
      const target = hero.lockTarget === 0 ? undefined : ctx.entity(hero.lockTarget)?.get(Target)
      // A target exactly where he stands has no direction (atan2(0, 0)): he keeps his facing.
      const toTarget =
        target === undefined || (target.x === hero.x && target.z === hero.z)
          ? undefined
          : angleOf(target.x - hero.x, target.z - hero.z)
      // Locked, the stick maps through the line to the target, so sideways circles it (G3-f, DESIGN.md §11.2).
      const direction = toTarget === undefined ? mapped.direction : mapStick(stick, toTarget)
      const moving = direction.x !== 0 || direction.z !== 0
      // Exact: both factors are integers under 2^17, so the product is exact and the division by 2^16 too.
      const dx = Math.trunc((direction.x * WALK_PER_TICK) / Q16)
      const dz = Math.trunc((direction.z * WALK_PER_TICK) / Q16)
      const { x, z } = slide(walls, HERO_HALF, hero, dx, dz)
      const travel = angleOf(direction.x, direction.z)
      const facing = target !== undefined ? (toTarget ?? hero.facing) : moving ? travel : hero.facing
      const moveDir = moving ? signedTurn(travel - facing) : 0
      entity.set(Hero, { x, z, facing, moving, moveDir })
    }
  },
})

/**
 * Puts Wick's camera in the view of the room he stands in. Entering another view takes its heading at once and,
 * with the stick held, latches the mapping to the old heading (`enterView`, M3R-D15); the next tick's move reads it.
 */
export const heroView: SystemDef = defineSystem({
  name: 'hero.view',
  phase: 'postPhysics',
  run(ctx) {
    const area = areaIn(ctx.content, ctx.resource(Location))
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

/**
 * Starts and ends Wick's actions (M3 spec §4.7): a slash press starts a slash at this tick, replacing any action
 * running (a second slash mid-swing; the view blends the two, M3R-D16); a point or pickup press starts only when
 * nothing runs. An action ends `ACTION_TICKS` after it started. Guard is a stance held while its button is.
 */
export const heroAct: SystemDef = defineSystem({
  name: 'hero.act',
  phase: 'prePhysics',
  run(ctx) {
    for (const entity of ctx.query(HeroAction, HeroControl)) {
      const { actHeld, actPressed } = entity.get(HeroControl)
      const before = entity.get(HeroAction)
      let { clip, startedAt } = before
      if (clip === ACTION_CLIP.slash && ctx.tick - startedAt >= ACTION_TICKS.slash) clip = 0
      if (clip === ACTION_CLIP.point && ctx.tick - startedAt >= ACTION_TICKS.point) clip = 0
      if (clip === ACTION_CLIP.pickup && ctx.tick - startedAt >= ACTION_TICKS.pickup) clip = 0
      if ((actPressed & ACTION_BITS.slash) !== 0) {
        clip = ACTION_CLIP.slash
        startedAt = ctx.tick
      } else if (clip === 0 && (actPressed & ACTION_BITS.point) !== 0) {
        clip = ACTION_CLIP.point
        startedAt = ctx.tick
      } else if (clip === 0 && (actPressed & ACTION_BITS.pickup) !== 0) {
        clip = ACTION_CLIP.pickup
        startedAt = ctx.tick
      }
      const guard = (actHeld & ACTION_BITS.guard) !== 0
      const guardSince = guard && !before.guard ? ctx.tick : before.guardSince
      entity.set(HeroAction, { clip, startedAt, guard, guardSince })
    }
  },
})
