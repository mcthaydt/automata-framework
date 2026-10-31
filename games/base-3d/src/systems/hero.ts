// Wick's systems: the stick, lock and buttons copied onto him, his move through the heading, the room's view entered
// and his actions.
import { CameraHeading, enterView, mapStick, moveDirection, Q16 } from '@mcthaydt/automata-render-pixi3d/sim'
import { defineSystem, type EntityRef, type SimContext, type SystemDef } from '@mcthaydt/automata-sim'
import { Act, Lock, LockCycle, Move } from '../commands.ts'
import { Fighter, Hero, HeroAction, HeroControl, Target } from '../components.ts'
import {
  ACTION_BITS,
  ACTION_CLIP,
  ACTION_TICKS,
  CombatState,
  FALL_COST,
  FALL_TICKS,
  HERO_HALF,
  KNOCKDOWN_TICKS,
  type MoveDef,
  WALK_PER_TICK,
} from '../constants/index.ts'
import { Location } from '../resources.ts'
import { areaIn, slide, viewAt, worldOf } from './area.ts'
import { frozen, isHeld } from './combat.ts'
import { facingVector } from './combat-geometry.ts'
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
    if (act?.action === true) actHeld |= ACTION_BITS.action
    if (act?.item === true) actHeld |= ACTION_BITS.item
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
    if (frozen(ctx)) return
    const { walls } = areaIn(ctx.content, ctx.resource(Location))
    const { moves } = worldOf(ctx.content)
    for (const entity of ctx.query(Hero, HeroControl, CameraHeading)) {
      const control = entity.get(HeroControl)
      const hero = entity.get(Hero)
      // Stunned, blocking, staggered or down, he does not walk; a knockback or a block's push moves him instead.
      const fighter = entity.has(Fighter) ? entity.get(Fighter) : undefined
      if (fighter !== undefined && isHeld(fighter.state)) {
        const pushed = fighter.pushTicks > 0
        const { x, z } = pushed ? slide(walls, HERO_HALF, hero, fighter.pushX, fighter.pushZ) : hero
        entity.set(Hero, { x, z, moving: false, moveDir: 0 })
        if (pushed) entity.set(Fighter, { pushTicks: fighter.pushTicks - 1 })
        continue
      }
      // The guard held halves the walk (DESIGN.md §7.2).
      const guarding = entity.has(HeroAction) && entity.get(HeroAction).guard
      const walk = guarding ? Math.trunc(WALK_PER_TICK / 2) : WALK_PER_TICK
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
      const travel = angleOf(direction.x, direction.z)

      // An Action press starts a roll, or a hop while locked (DESIGN.md §7.2); a roll or hop under way carries him.
      const pressed = (control.actPressed & ACTION_BITS.action) !== 0
      let carry = fighter === undefined ? undefined : carried(moves, fighter)
      if (fighter !== undefined && carry === undefined && pressed && canDodge(moves, fighter)) {
        const dodge = dodgeOf(stick, toTarget !== undefined, moving)
        const index = moves.findIndex((move) => move.id === dodge) + 1
        const def = moves[index - 1]
        if (def?.travel !== undefined) {
          const unit = facingVector(travel)
          const push = {
            pushX: Math.trunc((unit.x * def.travel) / 4096 / def.total),
            pushZ: Math.trunc((unit.z * def.travel) / 4096 / def.total),
          }
          const started = { move: index, moveTick: 1, moveStart: ctx.tick, state: CombatState.act, queued: 0 }
          entity.set(Fighter, { ...started, ...push, pushTicks: def.total })
          // The figure plays the dodge's clip from now (`combat.moves` keeps it, and clears it at the end).
          if (entity.has(HeroAction)) entity.set(HeroAction, { clip: ACTION_CLIP.move, startedAt: ctx.tick })
          carry = { ...push, pushTicks: def.total }
        }
      }
      if (carry !== undefined) {
        const { x, z } = slide(walls, HERO_HALF, hero, carry.pushX, carry.pushZ)
        const way = angleOf(carry.pushX, carry.pushZ)
        const facing = toTarget ?? way
        entity.set(Hero, { x, z, facing, moving: true, moveDir: signedTurn(way - facing) })
        entity.set(Fighter, { pushTicks: carry.pushTicks - 1 })
        fallIntoPit(ctx, entity, x, z)
        continue
      }

      // Exact: both factors are integers under 2^17, so the product is exact and the division by 2^16 too.
      const dx = Math.trunc((direction.x * walk) / Q16)
      const dz = Math.trunc((direction.z * walk) / Q16)
      const { x, z } = slide(walls, HERO_HALF, hero, dx, dz)
      const facing = target !== undefined ? (toTarget ?? hero.facing) : moving ? travel : hero.facing
      const moveDir = moving ? signedTurn(travel - facing) : 0
      entity.set(Hero, { x, z, facing, moving, moveDir })
      fallIntoPit(ctx, entity, x, z)
    }
  },
})

/** The push of a roll or hop under way, if one is: a running move with `travel` and ticks of it left. */
function carried(
  moves: readonly MoveDef[],
  fighter: {
    readonly move: number
    readonly pushX: number
    readonly pushZ: number
    readonly pushTicks: number
  },
): { pushX: number; pushZ: number; pushTicks: number } | undefined {
  const running = fighter.move === 0 ? undefined : moves[fighter.move - 1]
  return running?.travel !== undefined && fighter.pushTicks > 0 ? fighter : undefined
}

/** Whether Action may start a dodge now: idle, or cancelling a sword move (§7.2). */
function canDodge(
  moves: readonly MoveDef[],
  fighter: { readonly state: number; readonly move: number },
): boolean {
  if (fighter.state === CombatState.idle) return true
  return fighter.state === CombatState.act && moves[fighter.move - 1]?.hit !== undefined
}

/**
 * The dodge an Action press makes: unlocked, a roll if the stick moves him; locked, `hop-side` with the stick more
 * to a side than up or down, `hop-back` with it pulled back; nothing for forward or a centred stick (§7.2).
 */
function dodgeOf(
  stick: { readonly x: number; readonly y: number },
  locked: boolean,
  moving: boolean,
): string {
  if (!locked) return moving ? 'roll' : ''
  if (Math.abs(stick.x) > Math.abs(stick.y)) return 'hop-side'
  if (stick.y > 0 && stick.y >= Math.abs(stick.x)) return 'hop-back'
  return ''
}

/**
 * Wick's feet over a pit start a fall (§7.8): a half-heart, then `fall` for 60 ticks (`combat.status` returns him),
 * or, with no health left, the knockdown that ends in the game over.
 */
function fallIntoPit(ctx: SimContext, entity: EntityRef, x: number, z: number): void {
  if (!entity.has(Fighter)) return
  const { pits } = areaIn(ctx.content, ctx.resource(Location))
  if (!pits.some((pit) => x >= pit.minX && x < pit.maxX && z >= pit.minZ && z < pit.maxZ)) return
  const health = Math.max(0, entity.get(Fighter).health - FALL_COST)
  const stopped = { move: 0, moveTick: 0, queued: 0, pushTicks: 0 }
  entity.set(
    Fighter,
    health === 0
      ? { ...stopped, health, state: CombatState.down, stun: KNOCKDOWN_TICKS }
      : { ...stopped, health, state: CombatState.fall, stun: FALL_TICKS },
  )
}

/**
 * Puts Wick's camera in the view of the room he stands in. Entering another view takes its heading at once and,
 * with the stick held, latches the mapping to the old heading (`enterView`, M3R-D15); the next tick's move reads it.
 */
export const heroView: SystemDef = defineSystem({
  name: 'hero.view',
  phase: 'postPhysics',
  run(ctx) {
    if (frozen(ctx)) return
    const area = areaIn(ctx.content, ctx.resource(Location))
    for (const entity of ctx.query(Hero, HeroControl, CameraHeading)) {
      const { x, z } = entity.get(Hero)
      const view = viewAt(area, x, z)
      const heading = entity.get(CameraHeading)
      if (view === undefined || view.id === heading.view) continue
      const control = entity.get(HeroControl)
      entity.set(CameraHeading, enterView(heading, view, { x: control.stickX, y: control.stickY }))
      // Where he crossed into the room, facing his way in: a fall returns him here (DESIGN.md §7.8).
      const place = ctx.resource(Location)
      place.returnX = x
      place.returnZ = z
      place.returnFacing = entity.get(Hero).facing
    }
  },
})

/**
 * Starts and ends Wick's point and pickup (M3 spec §4.7): a press starts one only when nothing runs, and it ends
 * `ACTION_TICKS` after it started. The slash is a move now, started and chained by `combat.moves` (GAME-3D.1c).
 * Guard is a stance held while its button is.
 */
export const heroAct: SystemDef = defineSystem({
  name: 'hero.act',
  phase: 'prePhysics',
  run(ctx) {
    if (frozen(ctx)) return
    for (const entity of ctx.query(HeroAction, HeroControl)) {
      const { actHeld, actPressed } = entity.get(HeroControl)
      const before = entity.get(HeroAction)
      let { clip, startedAt } = before
      if (clip === ACTION_CLIP.point && ctx.tick - startedAt >= ACTION_TICKS.point) clip = 0
      if (clip === ACTION_CLIP.pickup && ctx.tick - startedAt >= ACTION_TICKS.pickup) clip = 0
      if (clip === 0 && (actPressed & ACTION_BITS.slash) === 0) {
        if ((actPressed & ACTION_BITS.point) !== 0) {
          clip = ACTION_CLIP.point
          startedAt = ctx.tick
        } else if ((actPressed & ACTION_BITS.pickup) !== 0) {
          clip = ACTION_CLIP.pickup
          startedAt = ctx.tick
        }
      }
      const guard = (actHeld & ACTION_BITS.guard) !== 0
      const guardSince = guard && !before.guard ? ctx.tick : before.guardSince
      entity.set(HeroAction, { clip, startedAt, guard, guardSince })
    }
  },
})
