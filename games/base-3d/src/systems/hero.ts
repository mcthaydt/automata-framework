// Wick's systems: the stick and the roll button copied onto him, his move through the heading (the walk, and the roll
// that carries him across a gap), a fall into a pit put right, and the room's view entered.
import { CameraHeading, enterView, mapStick, moveDirection, Q16 } from '@mcthaydt/automata-render-pixi3d/sim'
import { defineSystem, type EntityRef, type SimContext, type SystemDef } from '@mcthaydt/automata-sim'
import { Act, Move } from '../commands.ts'
import { Hero, HeroAction, HeroControl } from '../components.ts'
import { ACTION_CLIP, HERO_HALF, ROLL, WALK_PER_TICK } from '../constants/index.ts'
import { HeroFell, HeroRolled } from '../events.ts'
import { Location } from '../resources.ts'
import { type Area, areaOf, slide, viewAt } from './area.ts'
import { angleOf } from './geometry.ts'

/** Copies this tick's stick and roll button onto Wick, and marks the tick the button went down. */
export const heroInput: SystemDef = defineSystem({
  name: 'hero.input',
  phase: 'input',
  run(ctx) {
    const moves = ctx.commands.of(Move)
    const acts = ctx.commands.of(Act)
    const stick = moves[moves.length - 1]?.payload ?? { x: 0, y: 0 }
    const rollHeld = acts[acts.length - 1]?.payload.roll ?? false
    for (const entity of ctx.query(HeroControl)) {
      const before = entity.get(HeroControl)
      entity.set(HeroControl, {
        stickX: stick.x,
        stickY: stick.y,
        rollHeld,
        rollPressed: rollHeld && !before.rollHeld,
      })
    }
  },
})

/**
 * Moves Wick through the camera's heading (or the latched one, M3R-D15) at the walk speed scaled by the stick's push.
 * He faces the way he travels; standing, he keeps his facing. A roll press starts a lunge in the way he faces
 * (the stick's way, or the way he already faced), `ROLL.travel` over `ROLL.ticks`, which carries him across a gap.
 * Walls stop him (`slide`); his feet in a pit put him back on the last safe spot.
 */
export const heroMove: SystemDef = defineSystem({
  name: 'hero.move',
  phase: 'physics',
  run(ctx) {
    const area = areaOf(ctx.content)
    for (const entity of ctx.query(Hero, HeroControl, HeroAction, CameraHeading)) {
      const control = entity.get(HeroControl)
      const hero = entity.get(Hero)
      const action = entity.get(HeroAction)
      const stick = { x: control.stickX, y: control.stickY }
      const mapped = moveDirection(entity.get(CameraHeading), stick)
      entity.set(CameraHeading, mapped.state)
      const moving = mapped.direction.x !== 0 || mapped.direction.z !== 0
      const travel = moving ? angleOf(mapped.direction.x, mapped.direction.z) : hero.facing

      let rolling = action.pushTicks > 0
      let push = { x: action.pushX, z: action.pushZ }
      if (!rolling && control.rollPressed) {
        // The lunge goes the way the stick points, else the way he faces: one full-length step of the facing's unit.
        const unit = mapStick({ x: 0, y: -127 }, travel)
        push = {
          x: Math.trunc((unit.x * ROLL.travel) / (Q16 * ROLL.ticks)),
          z: Math.trunc((unit.z * ROLL.travel) / (Q16 * ROLL.ticks)),
        }
        entity.set(HeroAction, {
          clip: ACTION_CLIP.roll,
          startedAt: ctx.tick,
          pushX: push.x,
          pushZ: push.z,
          pushTicks: ROLL.ticks,
        })
        rolling = true
        ctx.emit(HeroRolled, { x: hero.x, z: hero.z })
      }

      const walls = area.walls
      if (rolling) {
        const { x, z } = slide(walls, HERO_HALF, hero, push.x, push.z)
        const ticks = entity.get(HeroAction).pushTicks - 1
        entity.set(
          HeroAction,
          ticks === 0 ? { clip: 0, pushX: 0, pushZ: 0, pushTicks: 0 } : { pushTicks: ticks },
        )
        entity.set(Hero, { x, z, facing: angleOf(push.x, push.z), moving: true, moveDir: 0 })
        // A roll carries him over a pit: only where it ends can he fall (a lunge passes over the gap).
        if (ticks === 0) fallIfInPit(ctx, entity, area, x, z)
        continue
      }

      // Exact: both factors are integers under 2^17, so the product is exact and the division by 2^16 too.
      const dx = Math.trunc((mapped.direction.x * WALK_PER_TICK) / Q16)
      const dz = Math.trunc((mapped.direction.z * WALK_PER_TICK) / Q16)
      const { x, z } = slide(walls, HERO_HALF, hero, dx, dz)
      entity.set(Hero, { x, z, facing: travel, moving, moveDir: 0 })
      fallIfInPit(ctx, entity, area, x, z)
    }
  },
})

/** Wick's feet in a pit put him back where he last crossed into a room, facing his way in, with nothing lost. */
function fallIfInPit(ctx: SimContext, entity: EntityRef, area: Area, x: number, z: number): void {
  if (!area.pits.some((pit) => x >= pit.minX && x < pit.maxX && z >= pit.minZ && z < pit.maxZ)) return
  const place = ctx.resource(Location)
  entity.set(Hero, {
    x: place.returnX,
    z: place.returnZ,
    facing: place.returnFacing,
    moving: false,
    moveDir: 0,
  })
  entity.set(HeroAction, { clip: 0, pushX: 0, pushZ: 0, pushTicks: 0 })
  ctx.emit(HeroFell, { x, z })
}

/**
 * Puts Wick's camera in the view of the room he stands in. Entering another view takes its heading at once and, with the
 * stick held, latches the mapping to the old heading (`enterView`, M3R-D15); the next tick's move reads it.
 */
export const heroView: SystemDef = defineSystem({
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
      // Where he crossed into the room, facing his way in: a fall returns him here.
      const place = ctx.resource(Location)
      place.returnX = x
      place.returnZ = z
      place.returnFacing = entity.get(Hero).facing
    }
  },
})
